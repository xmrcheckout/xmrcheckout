from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import datetime, timezone

from requests import RequestException
from sqlalchemy.orm import Session

from .formatting import is_overpaid, is_partially_paid
from .models import BtcpayWebhook, Invoice, InvoiceTransfer, WebhookDelivery
from .payment_timing import is_payment_after_expiry
from .security import decrypt_secret
from .webhook_http import (
    UnsafeWebhookUrl,
    post_webhook_with_redirects,
)
from .webhook_retry import next_attempt_time

logger = logging.getLogger(__name__)


def payment_observation_evidence(
    db: Session | None,
    invoice: Invoice,
) -> dict[str, object]:
    """Build payment evidence for the BTCPay-compatible wire contract.

    Evidence is derived only from persisted positive incoming transfers. A
    missing database session is supported for isolated status tests; real
    webhook dispatch always supplies one.
    """
    transfers = []
    if db is not None:
        transfers = (
            db.query(InvoiceTransfer)
            .filter(
                InvoiceTransfer.invoice_id == invoice.id,
                InvoiceTransfer.amount_atomic > 0,
            )
            .order_by(InvoiceTransfer.created_at.asc(), InvoiceTransfer.txid.asc())
            .all()
        )

    observed_at = None
    observation_times = [
        transfer.updated_at or transfer.created_at
        for transfer in transfers
        if transfer.updated_at or transfer.created_at
    ]
    if observation_times:
        observed_at = max(observation_times).isoformat()

    return {
        "confirmationsRequired": getattr(invoice, "confirmation_target", 0),
        "confirmationsObserved": getattr(invoice, "confirmations", 0) or 0,
        "transactionIds": [transfer.txid for transfer in transfers],
        "observedAt": observed_at,
        "observationSource": "xmrcheckout wallet-rpc",
    }


def send_btcpay_webhook(
    hook: BtcpayWebhook,
    url: str,
    payload: dict[str, object],
) -> tuple[int | None, str | None]:
    """Make one signed delivery attempt and return (http_status, error_message)."""
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    try:
        secret = decrypt_secret(hook.secret_encrypted)
        headers = {
            "BTCPay-Sig": f"sha256={_sign_payload(body, secret)}",
            "Content-Type": "application/json",
            "User-Agent": "xmrcheckout-btcpay-webhook/1.0",
        }
        response = post_webhook_with_redirects(
            url,
            data=body,
            headers=headers,
            timeout=10,
        )
        if response is None:
            raise RequestException("Webhook redirect limit exceeded")
        status_code = response.status_code
    except (RequestException, UnsafeWebhookUrl) as exc:
        logger.warning(
            "BTCPay webhook delivery failed",
            extra={"webhook_id": str(hook.id), "event": payload.get("type")},
        )
        logger.debug("BTCPay webhook delivery error: %s", exc)
        return None, str(exc)
    except Exception as exc:
        logger.error(
            "BTCPay webhook dispatch failed: %s",
            exc,
            extra={"webhook_id": str(hook.id), "event": payload.get("type")},
        )
        return None, "Webhook dispatch failed"
    if status_code >= 400:
        logger.warning(
            "BTCPay webhook delivered non-success status",
            extra={
                "webhook_id": str(hook.id),
                "event": payload.get("type"),
                "http_status": status_code,
            },
        )
    return status_code, None


def dispatch_btcpay_webhooks(
    db: Session,
    user_id: str,
    event_type: str,
    invoice: Invoice,
    *,
    manually_marked: bool = False,
) -> None:
    hooks = (
        db.query(BtcpayWebhook)
        .filter(
            BtcpayWebhook.user_id == user_id,
            BtcpayWebhook.enabled.is_(True),
        )
        .all()
    )
    if not hooks:
        return
    payload = _build_payload(
        db=db,
        event_type=event_type,
        user_id=user_id,
        invoice=invoice,
        manually_marked=manually_marked,
    )
    deliveries: list[WebhookDelivery] = []
    for hook in hooks:
        if not event_allowed(hook.authorized_events, event_type):
            continue
        status_code, error_message = send_btcpay_webhook(hook, hook.url, payload)
        next_attempt_at = None
        if getattr(hook, "automatic_redelivery", True):
            next_attempt_at = next_attempt_time(1, status_code, datetime.now(timezone.utc))
        deliveries.append(
            WebhookDelivery(
                user_id=uuid.UUID(str(user_id)),
                webhook_id=hook.id,
                kind="btcpay",
                event=event_type,
                url=hook.url,
                invoice_id=invoice.id,
                invoice_address=getattr(invoice, "address", None),
                invoice_subaddress_index=getattr(invoice, "subaddress_index", None),
                invoice_amount_xmr=getattr(invoice, "amount_xmr", None),
                invoice_status=getattr(invoice, "status", None),
                payload_json=payload,
                http_status=status_code,
                error_message=error_message,
                attempt=1,
                next_attempt_at=next_attempt_at,
            )
        )
    if deliveries:
        try:
            db.add_all(deliveries)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning(
                "Failed to save BTCPay webhook delivery history",
                extra={"error": str(exc)},
            )


def event_allowed(authorized_events: object, event_type: str) -> bool:
    if not isinstance(authorized_events, dict):
        return False
    if authorized_events.get("everything") is True:
        return True
    specific = authorized_events.get("specificEvents") or []
    return event_type in specific


def _build_payload(
    *,
    db: Session | None = None,
    event_type: str,
    user_id: str,
    invoice: Invoice,
    manually_marked: bool,
) -> dict[str, object]:
    payload = {
        "type": event_type,
        "timestamp": int(time.time()),
        "storeId": user_id,
        "invoiceId": str(invoice.id),
        "manuallyMarked": manually_marked,
        "overPaid": is_overpaid(invoice),
        "partiallyPaid": is_partially_paid(invoice),
        "afterExpiration": is_payment_after_expiry(invoice),
        "metadata": invoice.metadata_json or {},
    }
    payload.update(payment_observation_evidence(db, invoice))
    return payload


def _sign_payload(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
