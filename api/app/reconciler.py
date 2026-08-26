from __future__ import annotations

from contextlib import contextmanager
import hashlib
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN

from fastapi import HTTPException
from monero.backends.jsonrpc.exceptions import RPCError
from requests import RequestException
from sqlalchemy import and_, or_, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .btcpay_webhooks import dispatch_btcpay_webhooks
from .config import INVOICE_RECONCILE_INTERVAL_SECONDS, LATE_PAYMENT_LOOKBACK_HOURS
from .db import SessionLocal, engine
from .models import Invoice, InvoiceTransfer, SystemStatus, User
from .monero_service import MoneroWalletService, TransferDetail, wallet_error_summary
from .payment_timing import classify_payment_timing, effective_confirmations
from .webhooks import dispatch_webhooks

logger = logging.getLogger(__name__)
MONERO_CONNECTIVITY_STATUS_NAME = "monero_connectivity"
_UNSET = object()


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
    while True:
        status_db: Session | None = None
        try:
            status_db = SessionLocal()
            service.begin_reconcile_cycle()
            _safe_update_monero_connectivity_status(status_db, service)
            _safe_update_reconciler_status(
                status_db,
                started_at=datetime.now(timezone.utc),
            )
            summary = _reconcile_invoices(service)
            if summary.failed:
                _safe_update_reconciler_status(
                    status_db,
                    error_message=(
                        f"{summary.failed} of {summary.attempted} invoice checks failed"
                    ),
                    attempted_invoices=summary.attempted,
                    succeeded_invoices=summary.succeeded,
                    failed_invoices=summary.failed,
                )
            else:
                _safe_update_reconciler_status(
                    status_db,
                    completed_at=datetime.now(timezone.utc),
                    error_message=None,
                    attempted_invoices=summary.attempted,
                    succeeded_invoices=summary.succeeded,
                    failed_invoices=summary.failed,
                )
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
        time.sleep(INVOICE_RECONCILE_INTERVAL_SECONDS)


def _reconcile_invoices(service: MoneroWalletService) -> ReconcileSummary:
    db: Session = SessionLocal()
    attempted = 0
    succeeded = 0
    failed = 0
    try:
        now = datetime.now(timezone.utc)
        late_cutoff = _expired_invoice_cutoff(db, now=now)
        invoices = (
            db.query(Invoice)
            .filter(
                or_(
                    Invoice.status.in_(["pending", "payment_detected"]),
                    and_(
                        Invoice.status == "expired",
                        Invoice.expires_at.is_not(None),
                        Invoice.expires_at >= late_cutoff,
                    ),
                )
            )
            .order_by(Invoice.created_at.asc())
            .all()
        )
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
        for user_id, user_invoices in user_groups.items():
            user = db.query(User).filter(User.id == user_id).first()
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
            for invoice in user_invoices:
                with _invoice_advisory_lock(invoice.id) as acquired:
                    if not acquired:
                        logger.info(
                            "Skipping invoice already being reconciled",
                            extra={"invoice_id": str(invoice.id)},
                        )
                        continue
                    if _reconcile_invoice(db, service, user, invoice):
                        succeeded += 1
                    else:
                        failed += 1
        return ReconcileSummary(
            attempted=attempted,
            succeeded=succeeded,
            failed=failed,
        )
    finally:
        db.close()


def _reconcile_invoice(
    db: Session,
    service: MoneroWalletService,
    user: User,
    invoice: Invoice,
) -> bool:
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
        if invoice.status == "pending" and is_after_expiry:
            logger.info(
                "Invoice expired",
                extra={"invoice_id": str(invoice.id), "user_id": str(user.id)},
            )
            invoice.status = "expired"
            db.add(invoice)
            db.commit()
            dispatch_webhooks(db, str(user.id), "invoice.expired", invoice)
            dispatch_btcpay_webhooks(db, str(user.id), "InvoiceExpired", invoice)
        return True

    payment_transition = is_paid and invoice.status in ("pending", "expired")
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
        dispatch_webhooks(db, str(user.id), "invoice.payment_detected", invoice)
        dispatch_btcpay_webhooks(db, str(user.id), "InvoiceReceivedPayment", invoice)
        dispatch_btcpay_webhooks(db, str(user.id), "InvoicePaidInFull", invoice)
        dispatch_btcpay_webhooks(db, str(user.id), "InvoiceProcessing", invoice)

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
        dispatch_webhooks(db, str(user.id), "invoice.confirmed", invoice)
        dispatch_btcpay_webhooks(db, str(user.id), "InvoiceSettled", invoice)
        dispatch_btcpay_webhooks(db, str(user.id), "InvoicePaymentSettled", invoice)
    return True


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
        )
    except SQLAlchemyError:
        db.rollback()
        logger.warning("Unable to persist reconciler status heartbeat", exc_info=True)




def _xmr_to_atomic(amount: Decimal) -> int:
    quantized = (Decimal(amount) * Decimal("1000000000000")).to_integral_value(
        rounding=ROUND_DOWN
    )
    return int(quantized)


def _expired_invoice_cutoff(db: Session, *, now: datetime) -> datetime:
    lookback = timedelta(hours=max(0, LATE_PAYMENT_LOOKBACK_HOURS))
    status_row = (
        db.query(SystemStatus)
        .filter(SystemStatus.name == "reconciler")
        .first()
    )
    last_completed = status_row.last_reconcile_completed_at if status_row else None
    if last_completed is None:
        anchor = now
    else:
        if last_completed.tzinfo is None:
            last_completed = last_completed.replace(tzinfo=timezone.utc)
        else:
            last_completed = last_completed.astimezone(timezone.utc)
        anchor = min(last_completed, now)
    return anchor - lookback


if __name__ == "__main__":
    main()
