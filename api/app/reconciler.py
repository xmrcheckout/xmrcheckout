from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from .btcpay_webhooks import dispatch_btcpay_webhooks
from .config import INVOICE_RECONCILE_INTERVAL_SECONDS, LATE_PAYMENT_LOOKBACK_HOURS
from .db import SessionLocal
from .models import Invoice, InvoiceTransfer, User
from .monero_service import MoneroWalletService, TransferDetail
from .webhooks import dispatch_webhooks

logger = logging.getLogger(__name__)


def main() -> None:
    level_name = "INFO"
    try:
        level_name = __import__("os").getenv("LOG_LEVEL", "INFO")
    except Exception:
        level_name = "INFO"
    level = getattr(logging, level_name.upper(), logging.INFO)
    logging.basicConfig(level=level)
    service = MoneroWalletService()
    while True:
        try:
            _reconcile_invoices(service)
        except Exception as exc:
            logger.exception("Invoice reconcile failed: %s", exc)
        time.sleep(INVOICE_RECONCILE_INTERVAL_SECONDS)


def _reconcile_invoices(service: MoneroWalletService) -> None:
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        late_cutoff = now - timedelta(hours=max(0, LATE_PAYMENT_LOOKBACK_HOURS))
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
            if invoice.user_id is None:
                logger.debug(
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
                logger.debug(
                    "Skipping invoices with missing user",
                    extra={"user_id": str(user_id)},
                )
                continue
            if not user.payment_address or not user.view_key_encrypted:
                logger.debug(
                    "Skipping invoices without payment address",
                    extra={"user_id": str(user.id)},
                )
                continue
            for invoice in user_invoices:
                try:
                    transfers = service.get_transfers_for_address(
                        user=user,
                        address=invoice.address,
                    )
                except Exception as exc:
                    logger.warning(
                        "Skipping invoice reconcile due to wallet RPC error",
                        extra={"invoice_id": str(invoice.id), "user_id": str(user.id)},
                    )
                    logger.debug("Wallet RPC error: %s", exc)
                    continue
                total_atomic = 0
                max_confirmations = 0
                for transfer in transfers:
                    if transfer.amount_atomic <= 0:
                        continue
                    total_atomic += transfer.amount_atomic
                    if transfer.confirmations > max_confirmations:
                        max_confirmations = transfer.confirmations
                logger.debug(
                    "Invoice totals",
                    extra={
                        "invoice_id": str(invoice.id),
                        "received_atomic": total_atomic,
                        "confirmations": max_confirmations,
                    },
                )
                now = datetime.now(timezone.utc)
                previous_confirmations = invoice.confirmations or 0
                total_changed = invoice.total_paid_atomic != total_atomic
                confirmations_changed = previous_confirmations != max_confirmations
                transfers_changed = _sync_invoice_transfers(
                    db,
                    invoice=invoice,
                    transfers=transfers,
                )
                if total_changed or confirmations_changed or transfers_changed:
                    if confirmations_changed:
                        invoice.confirmations = max_confirmations
                    if total_changed:
                        invoice.total_paid_atomic = total_atomic
                    db.add(invoice)
                    db.commit()
                required_atomic = _xmr_to_atomic(invoice.amount_xmr)
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
                        dispatch_btcpay_webhooks(
                            db, str(user.id), "InvoiceExpired", invoice
                        )
                    continue

                if is_paid and invoice.status in ("pending", "expired"):
                    logger.info(
                        "Invoice marked payment detected",
                        extra={"invoice_id": str(invoice.id), "user_id": str(user.id)},
                    )
                    previous_status = invoice.status
                    invoice.status = "payment_detected"
                    if invoice.detected_at is None:
                        invoice.detected_at = now
                    if previous_status == "expired" or (previous_status == "pending" and is_after_expiry):
                        invoice.paid_after_expiry = True
                        if invoice.paid_after_expiry_at is None:
                            invoice.paid_after_expiry_at = now
                    db.add(invoice)
                    db.commit()
                    dispatch_webhooks(db, str(user.id), "invoice.payment_detected", invoice)
                    dispatch_btcpay_webhooks(
                        db, str(user.id), "InvoiceReceivedPayment", invoice
                    )
                    dispatch_btcpay_webhooks(
                        db, str(user.id), "InvoiceProcessing", invoice
                    )
                if max_confirmations >= invoice.confirmation_target and invoice.status != "confirmed":
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
                    dispatch_btcpay_webhooks(
                        db, str(user.id), "InvoicePaymentSettled", invoice
                    )
    finally:
        db.close()


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
    for stored in existing:
        if stored.txid not in seen_txids:
            db.delete(stored)
            changed = True
    return changed




def _xmr_to_atomic(amount: Decimal) -> int:
    quantized = (Decimal(amount) * Decimal("1000000000000")).to_integral_value(
        rounding=ROUND_DOWN
    )
    return int(quantized)


if __name__ == "__main__":
    main()
