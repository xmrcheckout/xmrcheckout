from __future__ import annotations

from contextlib import contextmanager
import hashlib
import logging
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN

from fastapi import HTTPException
from monero.backends.jsonrpc.exceptions import RPCError
from requests import RequestException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .btcpay_webhooks import dispatch_btcpay_webhooks
from .config import (
    INVOICE_RECONCILE_INTERVAL_SECONDS,
    TERMINAL_RECONCILE_INTERVAL_SECONDS,
)
from .db import SessionLocal, engine
from .invoice_checks import AWAITING_PAYMENT_STATUSES, watched_invoice_criteria
from .models import Invoice, InvoiceTransfer, SubaddressAllocation, SystemStatus, User
from .monero_service import MoneroWalletService, TransferDetail, wallet_error_summary
from .payment_timing import classify_payment_timing, effective_confirmations
from .webhooks import dispatch_webhooks, retry_due_deliveries

logger = logging.getLogger(__name__)
MONERO_CONNECTIVITY_STATUS_NAME = "monero_connectivity"
_UNSET = object()
# How often the delivery loop looks for queued or due webhook deliveries.
WEBHOOK_DELIVERY_INTERVAL_SECONDS = 2
# How often a running full pass records that it is still alive. Must stay well
# below the staleness limit in routes._reconciler_state (90s at the minimum).
RECONCILER_HEARTBEAT_INTERVAL_SECONDS = 15


@dataclass(frozen=True)
class ReconcileSummary:
    attempted: int = 0
    succeeded: int = 0
    failed: int = 0


def _configure_logging(level: int) -> None:
    logging.basicConfig(level=level)
    # The Monero client logs raw RPC parameters at DEBUG, including view keys
    # and wallet passwords. Keep third-party transport logs above that level
    # even when application debugging is enabled.
    logging.getLogger("monero.backends.jsonrpc.wallet").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def main() -> None:
    level_name = "INFO"
    try:
        level_name = __import__("os").getenv("LOG_LEVEL", "INFO")
    except Exception:
        level_name = "INFO"
    level = getattr(logging, level_name.upper(), logging.INFO)
    _configure_logging(level)
    service = MoneroWalletService()
    # Webhooks are sent from their own thread so a slow merchant server never
    # delays payment detection.
    threading.Thread(
        target=_webhook_delivery_loop, name="webhook-delivery", daemon=True
    ).start()
    while True:
        status_db: Session | None = None
        try:
            status_db = SessionLocal()
            service.begin_reconcile_cycle()
            _safe_update_monero_connectivity_status(status_db, service)
            started_at = datetime.now(timezone.utc)
            _safe_update_reconciler_status(
                status_db,
                started_at=started_at,
                heartbeat_at=started_at,
            )
            summary = _reconcile_invoices(service)
            _record_cycle_result(status_db, summary)
        except Exception as exc:
            logger.exception("Invoice reconcile failed: %s", exc)
            if status_db is None:
                status_db = SessionLocal()
            _safe_update_monero_connectivity_error(status_db)
            _safe_update_reconciler_status(
                status_db,
                error_message="Invoice detection cycle failed",
            )
        finally:
            if status_db is not None:
                status_db.close()
        _wait_with_quick_checks(service, INVOICE_RECONCILE_INTERVAL_SECONDS)


def _webhook_delivery_loop() -> None:
    while True:
        _retry_webhook_deliveries()
        time.sleep(WEBHOOK_DELIVERY_INTERVAL_SECONDS)


def _retry_webhook_deliveries() -> None:
    """Send queued and due webhook deliveries; failures never affect invoice detection."""
    db: Session | None = None
    try:
        db = SessionLocal()
        sent = retry_due_deliveries(db)
        if sent:
            logger.info("Sent webhook deliveries", extra={"sent": sent})
    except Exception as exc:
        logger.warning("Webhook retry sweep failed: %s", exc)
    finally:
        if db is not None:
            db.close()


def _wait_with_quick_checks(service: MoneroWalletService, seconds: float) -> None:
    """Sleep until the next full cycle, running quick checks of open invoices meanwhile."""
    deadline = time.monotonic() + seconds
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        time.sleep(min(TERMINAL_RECONCILE_INTERVAL_SECONDS, remaining))
        if deadline - time.monotonic() <= 0:
            return
        try:
            service.begin_reconcile_cycle()
            _reconcile_invoices(service, quick=True)
        except Exception as exc:
            logger.warning("Quick invoice check failed: %s", exc)


def _record_cycle_result(status_db: Session, summary: ReconcileSummary) -> None:
    # A finished cycle counts as completed even if some checks failed; the
    # failures are still reported, and each invoice tracks its own last
    # successful check.
    completed_at = datetime.now(timezone.utc)
    _safe_update_reconciler_status(
        status_db,
        completed_at=completed_at,
        heartbeat_at=completed_at,
        error_message=(
            f"{summary.failed} of {summary.attempted} invoice checks failed"
            if summary.failed
            else None
        ),
        attempted_invoices=summary.attempted,
        succeeded_invoices=summary.succeeded,
        failed_invoices=summary.failed,
    )


def _send_reconciler_heartbeat() -> None:
    """Record that a full pass is still running, in its own short session."""
    db: Session | None = None
    try:
        db = SessionLocal()
        _safe_update_reconciler_status(db, heartbeat_at=datetime.now(timezone.utc))
    except Exception:
        logger.warning("Unable to record reconciler heartbeat", exc_info=True)
    finally:
        if db is not None:
            db.close()


def _reconcile_invoices(service: MoneroWalletService, *, quick: bool = False) -> ReconcileSummary:
    """Check every watched invoice, or with quick=True run the short check between full passes.

    The quick check covers open invoices of merchants with a recent terminal
    sale (their wallet is opened if needed, because a customer is waiting at
    the till) and of merchants whose wallet is already open. It never opens a
    wallet for anyone else, so it adds no wallet switches for them.
    """
    db: Session = SessionLocal()
    last_heartbeat = time.monotonic()

    def maybe_heartbeat() -> None:
        # Long full passes keep the health check fresh between start and completion.
        nonlocal last_heartbeat
        if quick:
            return
        if time.monotonic() - last_heartbeat >= RECONCILER_HEARTBEAT_INTERVAL_SECONDS:
            _send_reconciler_heartbeat()
            last_heartbeat = time.monotonic()

    attempted = 0
    succeeded = 0
    failed = 0
    try:
        now = datetime.now(timezone.utc)
        if quick:
            criteria = Invoice.status.in_(AWAITING_PAYMENT_STATUSES)
        else:
            criteria = watched_invoice_criteria(now=now)
        invoices = (
            db.query(Invoice)
            .filter(criteria)
            .order_by(Invoice.created_at.asc())
            .all()
        )
        if quick:
            invoices = _quick_check_invoices(db, service, invoices, now=now)
            if not invoices:
                return ReconcileSummary(attempted=0, succeeded=0, failed=0)
        user_groups: dict[object, list[Invoice]] = {}
        for invoice in invoices:
            attempted += 1
            if invoice.user_id is None:
                failed += 1
                logger.warning(
                    "Skipping invoice without user",
                    extra={"invoice_id": str(invoice.id)},
                )
                continue
            user_groups.setdefault(invoice.user_id, []).append(invoice)
        logger.debug(
            "Reconciling %d invoices across %d users",
            len(invoices),
            len(user_groups),
        )
        users = {
            user_id: db.query(User).filter(User.id == user_id).first()
            for user_id in user_groups
        }
        for user_id in _open_wallets_first(service, users):
            user_invoices = user_groups[user_id]
            maybe_heartbeat()
            user = users[user_id]
            if user is None:
                failed += len(user_invoices)
                logger.warning(
                    "Skipping invoices with missing user",
                    extra={"user_id": str(user_id)},
                )
                continue
            if not user.payment_address or not user.view_key_encrypted:
                failed += len(user_invoices)
                logger.warning(
                    "Skipping invoices without payment address",
                    extra={"user_id": str(user.id)},
                )
                continue
            try:
                if quick:
                    service.refresh_wallet(user)
                else:
                    service.ensure_wallet_ready(user)
            except Exception as exc:
                failed += len(user_invoices)
                logger.warning(
                    "Skipping user invoice checks because wallet is not ready user_id=%s invoice_count=%d error=%s",
                    user.id,
                    len(user_invoices),
                    wallet_error_summary(exc),
                )
                continue
            checked_at = datetime.now(timezone.utc)
            checked_ids = []
            for invoice in user_invoices:
                with _invoice_advisory_lock(f"allocation:{user.id}") as acquired:
                    if not acquired:
                        logger.info(
                            "Skipping invoice while merchant allocation or detection is busy",
                            extra={"invoice_id": str(invoice.id)},
                        )
                        continue
                    if _reconcile_invoice(db, service, user, invoice):
                        succeeded += 1
                        checked_ids.append(invoice.id)
                    else:
                        failed += 1
                maybe_heartbeat()
            _record_successful_checks(db, checked_ids, checked_at)
        return ReconcileSummary(
            attempted=attempted,
            succeeded=succeeded,
            failed=failed,
        )
    finally:
        db.close()


def _quick_check_invoices(
    db: Session, service: MoneroWalletService, invoices: list[Invoice], *, now: datetime,
) -> list[Invoice]:
    """Keep the open invoices of merchants that the quick check covers.

    A merchant is covered when a terminal screen may still show one of their
    sales (created in the last two hours), or when their wallet is already
    open. _open_wallets_first then reads the open wallets before any terminal
    sale switches the wallet on a shared wallet-rpc.
    """
    recent = now - timedelta(hours=2)
    terminal_users = set()
    for invoice in invoices:
        created_at = invoice.created_at
        if created_at is not None and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if invoice.terminal_id is not None and created_at is not None and created_at >= recent:
            terminal_users.add(invoice.user_id)
    covered = set(terminal_users)
    for user_id in {invoice.user_id for invoice in invoices} - terminal_users:
        if user_id is None:
            continue
        user = db.query(User).filter(User.id == user_id).first()
        if service.wallet_is_open(user):
            covered.add(user_id)
    return [invoice for invoice in invoices if invoice.user_id in covered]


def _open_wallets_first(service: MoneroWalletService, users: dict) -> list:
    """Order merchants so wallets already open are checked before any wallet switch.

    A wallet-rpc shard holds one open wallet, so starting with it saves one
    slow close-and-open per shard per pass. Otherwise the order is unchanged.
    """
    return sorted(users, key=lambda user_id: not service.wallet_is_open(users[user_id]))


def _record_successful_checks(db: Session, invoice_ids: list, checked_at: datetime) -> None:
    if not invoice_ids:
        return
    try:
        db.query(Invoice).filter(Invoice.id.in_(invoice_ids)).update(
            {Invoice.last_checked_at: checked_at},
            synchronize_session=False,
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.warning("Unable to record successful invoice checks", exc_info=True)


def _reconcile_invoice(
    db: Session,
    service: MoneroWalletService,
    user: User,
    invoice: Invoice,
) -> bool:
    allocations = db.query(SubaddressAllocation).filter(
        SubaddressAllocation.user_id == user.id,
        SubaddressAllocation.address == invoice.address,
    ).order_by(SubaddressAllocation.generation.desc()).all()
    allocation = allocations[0] if allocations else None
    if allocation is not None and allocation.invoice_id != invoice.id:
        # A newer allocation owns future observations; preserve older invoice history.
        return True
    try:
        transfers = _get_transfers_with_retry(
            service,
            user=user,
            address=invoice.address,
        )
    except Exception as exc:
        logger.warning(
            "Skipping invoice reconcile due to wallet RPC error invoice_id=%s user_id=%s error=%s",
            invoice.id,
            user.id,
            wallet_error_summary(exc),
        )
        return False

    previous_exclusions = list(allocation.excluded_txids) if allocation is not None else []
    transfers = eligible_allocation_transfers(allocation, transfers)
    if allocation is not None and allocation.excluded_txids != previous_exclusions:
        db.add(allocation)
        db.commit()
    total_atomic = sum(
        transfer.amount_atomic
        for transfer in transfers
        if transfer.amount_atomic > 0
    )
    required_atomic = _xmr_to_atomic(invoice.amount_xmr)
    confirmations = effective_confirmations(transfers, required_atomic)
    logger.debug(
        "Invoice totals",
        extra={
            "invoice_id": str(invoice.id),
            "received_atomic": total_atomic,
            "confirmations": confirmations,
        },
    )
    now = datetime.now(timezone.utc)
    previous_confirmations = invoice.confirmations or 0
    total_changed = invoice.total_paid_atomic != total_atomic
    confirmations_changed = previous_confirmations != confirmations
    transfers_changed = _sync_invoice_transfers(
        db,
        invoice=invoice,
        transfers=transfers,
    )
    if total_changed or confirmations_changed or transfers_changed:
        if confirmations_changed:
            invoice.confirmations = confirmations
        if total_changed:
            invoice.total_paid_atomic = total_atomic
        db.add(invoice)
        db.commit()

    is_paid = total_atomic >= required_atomic
    expires_at = invoice.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    is_after_expiry = bool(expires_at and now >= expires_at)

    if total_atomic < required_atomic:
        logger.debug(
            "Payment not yet detected",
            extra={
                "invoice_id": str(invoice.id),
                "required_atomic": required_atomic,
                "received_atomic": total_atomic,
            },
        )
        if invoice.status == "payment_detected":
            # The detected payment is no longer observed (for example a
            # double-spend or a transaction dropped from the pool). Fall back
            # to the state the observed total implies; expiry below notifies.
            logger.info(
                "Invoice detected payment no longer observed",
                extra={
                    "invoice_id": str(invoice.id),
                    "user_id": str(user.id),
                    "received_atomic": total_atomic,
                },
            )
            invoice.status = "partially_paid" if total_atomic > 0 else "pending"
            invoice.detected_at = None
            invoice.paid_after_expiry = False
            invoice.paid_after_expiry_at = None
            db.add(invoice)
            db.commit()
            if not is_after_expiry:
                return True
        if invoice.status in ("pending", "partially_paid") and is_after_expiry:
            logger.info(
                "Invoice expired",
                extra={
                    "invoice_id": str(invoice.id),
                    "user_id": str(user.id),
                    "received_atomic": total_atomic,
                },
            )
            invoice.status = "expired"
            db.add(invoice)
            db.commit()
            dispatch_webhooks(db, str(user.id), "invoice.expired", invoice, queue=True)
            dispatch_btcpay_webhooks(db, str(user.id), "InvoiceExpired", invoice, queue=True)
            return True
        if invoice.status == "pending" and total_atomic > 0:
            logger.info(
                "Invoice partially paid",
                extra={
                    "invoice_id": str(invoice.id),
                    "user_id": str(user.id),
                    "required_atomic": required_atomic,
                    "received_atomic": total_atomic,
                },
            )
            invoice.status = "partially_paid"
            db.add(invoice)
            db.commit()
            _dispatch_partial_payment(db, user, invoice)
        elif invoice.status == "partially_paid" and total_atomic <= 0:
            # Previously observed funds disappeared (for example after a chain
            # reorganization); return to awaiting funds without notifying.
            logger.info(
                "Invoice partial payment no longer observed",
                extra={"invoice_id": str(invoice.id), "user_id": str(user.id)},
            )
            invoice.status = "pending"
            db.add(invoice)
            db.commit()
        elif invoice.status == "partially_paid" and total_changed:
            logger.info(
                "Invoice partial payment amount changed",
                extra={
                    "invoice_id": str(invoice.id),
                    "user_id": str(user.id),
                    "required_atomic": required_atomic,
                    "received_atomic": total_atomic,
                },
            )
            _dispatch_partial_payment(db, user, invoice)
        return True

    was_partially_paid = invoice.status == "partially_paid"
    payment_transition = is_paid and invoice.status in (
        "pending",
        "partially_paid",
        "expired",
    )
    if is_paid:
        detection_time = invoice.detected_at or now
        timing = classify_payment_timing(
            transfers=transfers,
            required_atomic=required_atomic,
            expires_at=expires_at,
            detection_fallback_at=detection_time,
        )
        if timing is not None and (
            invoice.paid_after_expiry != timing.paid_after_expiry
            or invoice.paid_after_expiry_at != timing.paid_after_expiry_at
        ):
            invoice.paid_after_expiry = timing.paid_after_expiry
            invoice.paid_after_expiry_at = timing.paid_after_expiry_at
            db.add(invoice)
            db.commit()

    if payment_transition:
        logger.info(
            "Invoice marked payment detected",
            extra={"invoice_id": str(invoice.id), "user_id": str(user.id)},
        )
        invoice.status = "payment_detected"
        if invoice.detected_at is None:
            invoice.detected_at = now
        db.add(invoice)
        db.commit()
        dispatch_webhooks(db, str(user.id), "invoice.payment_detected", invoice, queue=True)
        if not was_partially_paid or total_changed:
            # A final top-up is a newly received payment; an invoice that was
            # already signalled for the same observed amount is not.
            dispatch_btcpay_webhooks(
                db, str(user.id), "InvoiceReceivedPayment", invoice, queue=True
            )
        dispatch_btcpay_webhooks(db, str(user.id), "InvoicePaidInFull", invoice, queue=True)
        dispatch_btcpay_webhooks(db, str(user.id), "InvoiceProcessing", invoice, queue=True)

    if confirmations >= invoice.confirmation_target and invoice.status != "confirmed":
        logger.info(
            "Invoice confirmed",
            extra={"invoice_id": str(invoice.id), "user_id": str(user.id)},
        )
        invoice.status = "confirmed"
        if invoice.confirmed_at is None:
            invoice.confirmed_at = now
        db.add(invoice)
        db.commit()
        dispatch_webhooks(db, str(user.id), "invoice.confirmed", invoice, queue=True)
        dispatch_btcpay_webhooks(db, str(user.id), "InvoiceSettled", invoice, queue=True)
        dispatch_btcpay_webhooks(db, str(user.id), "InvoicePaymentSettled", invoice, queue=True)
    return True


def _dispatch_partial_payment(db: Session, user: User, invoice: Invoice) -> None:
    dispatch_webhooks(db, str(user.id), "invoice.partially_paid", invoice, queue=True)
    dispatch_btcpay_webhooks(db, str(user.id), "InvoiceReceivedPayment", invoice, queue=True)


def eligible_allocation_transfers(
    allocation: SubaddressAllocation | None, transfers: list[TransferDetail],
) -> list[TransferDetail]:
    if allocation is None or allocation.cutoff_height is None:
        return transfers
    excluded = set(allocation.excluded_txids)
    eligible = []
    for transfer in transfers:
        if transfer.txid in excluded:
            continue
        height = transfer.height
        if (type(height) is int and height < 0) or (
            transfer.confirmations > 0 and (type(height) is not int or height <= 0)
        ):
            logger.warning("Holding transfer with invalid block height invoice_id=%s txid=%s",
                           allocation.invoice_id, transfer.txid)
            continue
        if type(height) is int and height > 0 and height <= allocation.cutoff_height:
            # Remember newly discovered history even if it later moves above the
            # cutoff during a chain reorganization.
            excluded.add(transfer.txid)
            allocation.excluded_txids = sorted(excluded)
            continue
        eligible.append(transfer)
    return eligible


def _get_transfers_with_retry(
    service: MoneroWalletService,
    *,
    user: User,
    address: str,
    retries: int = 3,
) -> list[TransferDetail]:
    delays = (0.5, 1.0, 2.0)
    for attempt in range(retries):
        try:
            return service.get_transfers_for_address(user=user, address=address)
        except Exception as exc:
            retryable = isinstance(exc, (RPCError, RequestException)) or (
                isinstance(exc, HTTPException) and exc.status_code == 503
            )
            if not retryable or attempt == retries - 1:
                raise
            logger.warning(
                "Transient wallet RPC transfer read failed; retrying",
                extra={
                    "invoice_address": address,
                    "attempt": attempt + 1,
                    "max_attempts": retries,
                },
            )
            time.sleep(delays[attempt])
    raise RuntimeError("wallet RPC transfer read retries exhausted")


def _invoice_lock_key(invoice_id: object) -> int:
    digest = hashlib.sha256(
        f"xmrcheckout:invoice:{invoice_id}".encode("utf-8")
    ).digest()
    value = int.from_bytes(digest[:8], byteorder="big", signed=False)
    return value - (1 << 64) if value >= (1 << 63) else value


@contextmanager
def _invoice_advisory_lock(invoice_id: object):
    """Hold an invoice lock on a dedicated database connection.

    The reconciler commits invoice changes while the lock is held. A
    dedicated connection is therefore required because PostgreSQL session
    advisory locks belong to the connection, not the SQLAlchemy Session.
    """
    lock_key = _invoice_lock_key(invoice_id)
    connection = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
    acquired = False
    try:
        acquired = bool(
            connection.execute(
                text("SELECT pg_try_advisory_lock(:lock_key)"),
                {"lock_key": lock_key},
            ).scalar()
        )
        try:
            yield acquired
        finally:
            if acquired:
                try:
                    connection.execute(
                        text("SELECT pg_advisory_unlock(:lock_key)"),
                        {"lock_key": lock_key},
                    )
                except Exception:
                    logger.warning(
                        "Invoice advisory lock release failed",
                        extra={"invoice_id": str(invoice_id)},
                        exc_info=True,
                    )
    finally:
        connection.close()


def _sync_invoice_transfers(
    db: Session,
    *,
    invoice: Invoice,
    transfers: list[TransferDetail],
) -> bool:
    existing = (
        db.query(InvoiceTransfer)
        .filter(InvoiceTransfer.invoice_id == invoice.id)
        .all()
    )
    existing_by_txid = {transfer.txid: transfer for transfer in existing if transfer.txid}
    seen_txids: set[str] = set()
    changed = False
    for transfer in transfers:
        txid = transfer.txid
        if not txid:
            continue
        seen_txids.add(txid)
        stored = existing_by_txid.get(txid)
        if stored is None:
            db.add(
                InvoiceTransfer(
                    invoice_id=invoice.id,
                    txid=txid,
                    amount_atomic=transfer.amount_atomic,
                    confirmations=transfer.confirmations,
                    timestamp=transfer.timestamp,
                    address=transfer.address,
                )
            )
            changed = True
            continue
        if (
            stored.amount_atomic != transfer.amount_atomic
            or stored.confirmations != transfer.confirmations
            or stored.timestamp != transfer.timestamp
            or stored.address != transfer.address
        ):
            stored.amount_atomic = transfer.amount_atomic
            stored.confirmations = transfer.confirmations
            stored.timestamp = transfer.timestamp
            stored.address = transfer.address
            changed = True
    # Only prune transfers if we actually got data back from wallet-rpc.
    # An empty response (transient RPC glitch) should not wipe confirmed records.
    if transfers:
        for stored in existing:
            if stored.txid not in seen_txids:
                db.delete(stored)
                changed = True
    return changed


def _update_reconciler_status(
    db: Session,
    *,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    error_message: str | None | object = _UNSET,
    attempted_invoices: int | None = None,
    succeeded_invoices: int | None = None,
    failed_invoices: int | None = None,
    heartbeat_at: datetime | None = None,
) -> None:
    status_row = db.query(SystemStatus).filter(SystemStatus.name == "reconciler").first()
    if status_row is None:
        status_row = SystemStatus(name="reconciler")
    if started_at is not None:
        status_row.last_reconcile_started_at = started_at
    if completed_at is not None:
        status_row.last_reconcile_completed_at = completed_at
    if error_message is not _UNSET:
        status_row.last_reconcile_error = error_message
    if attempted_invoices is not None:
        status_row.last_reconcile_attempted_invoices = attempted_invoices
    if succeeded_invoices is not None:
        status_row.last_reconcile_succeeded_invoices = succeeded_invoices
    if failed_invoices is not None:
        status_row.last_reconcile_failed_invoices = failed_invoices
    if heartbeat_at is not None:
        # Set explicitly: onupdate does nothing when no other column changes.
        status_row.updated_at = heartbeat_at
    db.add(status_row)
    db.commit()


def _update_monero_connectivity_status(
    db: Session,
    *,
    wallet_rpc: str,
    daemon: str,
    daemon_height: int | None,
) -> None:
    status_row = (
        db.query(SystemStatus)
        .filter(SystemStatus.name == MONERO_CONNECTIVITY_STATUS_NAME)
        .first()
    )
    if status_row is None:
        status_row = SystemStatus(name=MONERO_CONNECTIVITY_STATUS_NAME)
    status_row.wallet_rpc = wallet_rpc
    status_row.daemon = daemon
    status_row.daemon_height = daemon_height
    status_row.checked_at = datetime.now(timezone.utc)
    db.add(status_row)
    db.commit()


def _safe_update_monero_connectivity_status(
    db: Session,
    service: MoneroWalletService,
) -> None:
    try:
        status_payload = service.get_status()
        _update_monero_connectivity_status(
            db,
            wallet_rpc=str(status_payload.get("wallet_rpc", "unreachable")),
            daemon=str(status_payload.get("daemon", "unknown")),
            daemon_height=(
                int(status_payload["daemon_height"])
                if isinstance(status_payload.get("daemon_height"), int)
                else None
            ),
        )
    except Exception:
        db.rollback()
        logger.warning("Unable to persist Monero connectivity status", exc_info=True)


def _safe_update_monero_connectivity_error(db: Session) -> None:
    try:
        _update_monero_connectivity_status(
            db,
            wallet_rpc="unreachable",
            daemon="unknown",
            daemon_height=None,
        )
    except SQLAlchemyError:
        db.rollback()
        logger.warning("Unable to persist Monero connectivity fallback", exc_info=True)


def _safe_update_reconciler_status(
    db: Session,
    *,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    error_message: str | None | object = _UNSET,
    attempted_invoices: int | None = None,
    succeeded_invoices: int | None = None,
    failed_invoices: int | None = None,
    heartbeat_at: datetime | None = None,
) -> None:
    try:
        _update_reconciler_status(
            db,
            started_at=started_at,
            completed_at=completed_at,
            error_message=error_message,
            attempted_invoices=attempted_invoices,
            succeeded_invoices=succeeded_invoices,
            failed_invoices=failed_invoices,
            heartbeat_at=heartbeat_at,
        )
    except SQLAlchemyError:
        db.rollback()
        logger.warning("Unable to persist reconciler status heartbeat", exc_info=True)




def _xmr_to_atomic(amount: Decimal) -> int:
    quantized = (Decimal(amount) * Decimal("1000000000000")).to_integral_value(
        rounding=ROUND_DOWN
    )
    return int(quantized)


if __name__ == "__main__":
    main()
