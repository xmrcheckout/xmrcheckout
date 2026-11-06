from __future__ import annotations

import json
import logging
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from datetime import datetime, timezone

from requests import RequestException
from sqlalchemy.orm import Session

from .formatting import format_xmr_amount, invoice_amounts
from .btcpay_webhooks import event_allowed as btcpay_event_allowed, send_btcpay_webhook
from .models import BtcpayWebhook, Invoice, User, Webhook, WebhookDelivery
from .public_origin import public_origin
from .security import decrypt_secret, encrypt_secret, generate_webhook_secret
from .webhook_http import UnsafeWebhookUrl, post_webhook_with_redirects
from .webhook_retry import next_attempt_time

logger = logging.getLogger(__name__)

# Upper bound on the wall-clock time one delivery attempt may take, however
# slowly the receiving server answers.
DELIVERY_DEADLINE_SECONDS = 15
# How many due deliveries one merchant may have sent per sweep; the rest wait
# for the next sweep so one merchant cannot crowd out the others.
MAX_DELIVERIES_PER_MERCHANT = 5
_SEND_POOL = ThreadPoolExecutor(max_workers=16, thread_name_prefix="webhook-send")
# Attempts that ran past the deadline and are still waiting on their server.
# A merchant with one of these gets no new attempts until it finishes.
_overdue_sends: dict[str, Future] = {}


def build_webhook_payload(event: str, invoice: Invoice) -> dict[str, object]:
    amount_paid_xmr, amount_remaining_xmr = invoice_amounts(invoice)
    origin = public_origin(None)
    metadata = invoice.metadata_json if isinstance(invoice.metadata_json, dict) else {}
    # The same payment page the create response links to: BTCPay invoices use
    # /i/, every other invoice /invoice/. The receipt only exists under /i/.
    page = "i" if "btcpay" in metadata else "invoice"
    return {
        "event": event,
        "invoice": {
            "id": str(invoice.id),
            "address": invoice.address,
            "subaddress_index": invoice.subaddress_index,
            "amount_xmr": format_xmr_amount(invoice.amount_xmr),
            "amount_paid_xmr": amount_paid_xmr,
            "amount_remaining_xmr": amount_remaining_xmr,
            "status": invoice.status,
            "confirmation_target": invoice.confirmation_target,
            "confirmations": invoice.confirmations or 0,
            "paid_after_expiry": bool(invoice.paid_after_expiry),
            "paid_after_expiry_at": _isoformat(invoice.paid_after_expiry_at),
            "metadata": invoice.metadata_json,
            "created_at": _isoformat(invoice.created_at),
            "expires_at": _isoformat(invoice.expires_at),
            "detected_at": _isoformat(invoice.detected_at),
            "confirmed_at": _isoformat(invoice.confirmed_at),
            "invoice_url": f"{origin}/{page}/{invoice.id}",
            "receipt_url": f"{origin}/i/{invoice.id}/receipt",
        },
    }


def send_native_webhook(
    url: str,
    payload: dict[str, object],
    webhook_secret: str | None,
    *,
    webhook_id: object = None,
) -> tuple[int | None, str | None]:
    """Make one delivery attempt and return (http_status, error_message)."""
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if webhook_secret:
        headers["X-Webhook-Secret"] = webhook_secret
    try:
        response = post_webhook_with_redirects(
            url,
            data=body,
            headers=headers,
            timeout=5,
        )
        if response is None:
            raise RequestException("Webhook redirect limit exceeded")
        return response.status_code, None
    except (RequestException, UnsafeWebhookUrl) as exc:
        logger.warning(
            "Webhook delivery failed",
            extra={"webhook_id": str(webhook_id), "event": payload.get("event")},
        )
        logger.debug("Webhook delivery error: %s", exc)
        return None, str(exc)


def dispatch_webhooks(
    db: Session,
    user_id: str,
    event: str,
    invoice: Invoice,
    *,
    queue: bool = False,
) -> None:
    """Record and send webhooks for an event.

    With queue=True nothing is sent here: each delivery is saved as due now
    and the delivery loop makes the first attempt, so the caller never waits
    on a merchant's server.
    """
    hooks = (
        db.query(Webhook)
        .filter(
            Webhook.user_id == user_id,
            Webhook.active.is_(True),
        )
        .all()
    )
    user = db.query(User).filter(User.id == user_id).first()
    webhook_secret = None
    if user is not None:
        webhook_secret = _ensure_webhook_secret(db, user)
    payload = build_webhook_payload(event, invoice)
    deliveries: list[WebhookDelivery] = []
    user_uuid = uuid.UUID(user_id)
    for hook in hooks:
        if event not in hook.events:
            continue
        hook_urls = hook.event_urls or {}
        target_url = hook_urls.get(event, hook.url)
        if not target_url:
            logger.warning(
                "Webhook URL missing for event",
                extra={"webhook_id": str(hook.id), "event": event},
            )
            continue
        now = datetime.now(timezone.utc)
        if queue:
            status_code, error_message = None, None
            attempt, next_attempt_at = 0, now
        else:
            status_code, error_message = send_native_webhook(
                target_url, payload, webhook_secret, webhook_id=hook.id
            )
            attempt = 1
            next_attempt_at = next_attempt_time(1, status_code, now)
        deliveries.append(
            WebhookDelivery(
                user_id=user_uuid,
                webhook_id=hook.id,
                kind="native",
                event=event,
                url=target_url,
                invoice_id=invoice.id,
                invoice_address=invoice.address,
                invoice_subaddress_index=invoice.subaddress_index,
                invoice_amount_xmr=invoice.amount_xmr,
                invoice_status=invoice.status,
                payload_json=payload,
                http_status=status_code,
                error_message=error_message,
                attempt=attempt,
                next_attempt_at=next_attempt_at,
            )
        )
    if deliveries:
        try:
            db.add_all(deliveries)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("Failed to save webhook delivery history", extra={"error": str(exc)})


def retry_due_deliveries(
    db: Session,
    *,
    now: datetime | None = None,
    limit: int = 50,
) -> int:
    """Send queued deliveries and retry failed ones whose time has come.

    A queued delivery (attempt 0) is updated in place with its first attempt;
    each retry is recorded as a new delivery row, so the history shows every
    attempt. Each merchant gets at most MAX_DELIVERIES_PER_MERCHANT attempts
    per sweep. Returns the number of attempts sent.
    """
    now = now or datetime.now(timezone.utc)
    for key in [key for key, future in _overdue_sends.items() if future.done()]:
        del _overdue_sends[key]
    rows = (
        db.query(WebhookDelivery.id, WebhookDelivery.user_id)
        .filter(
            WebhookDelivery.next_attempt_at.isnot(None),
            WebhookDelivery.next_attempt_at <= now,
        )
        .order_by(WebhookDelivery.next_attempt_at.asc())
        .limit(limit * 10)
        .all()
    )
    db.rollback()
    per_merchant: dict[str, int] = {}
    due_ids = []
    for row in rows:
        merchant = str(row.user_id)
        if merchant in _overdue_sends:
            continue
        if per_merchant.get(merchant, 0) >= MAX_DELIVERIES_PER_MERCHANT:
            continue
        per_merchant[merchant] = per_merchant.get(merchant, 0) + 1
        due_ids.append(row.id)
        if len(due_ids) >= limit:
            break
    sent = 0
    for delivery_id in due_ids:
        try:
            if _retry_delivery(db, delivery_id, now):
                sent += 1
        except Exception as exc:
            db.rollback()
            logger.warning(
                "Webhook retry failed",
                extra={"delivery_id": str(delivery_id), "error": str(exc)},
            )
    return sent


def _retry_delivery(db: Session, delivery_id: object, now: datetime) -> bool:
    # Lock the row so a concurrent sweep or manual redelivery cannot send the
    # same retry twice; the lock is held only for this one attempt.
    delivery = (
        db.query(WebhookDelivery)
        .filter(
            WebhookDelivery.id == delivery_id,
            WebhookDelivery.next_attempt_at.isnot(None),
            WebhookDelivery.next_attempt_at <= now,
        )
        .with_for_update(skip_locked=True)
        .first()
    )
    if delivery is None:
        db.rollback()
        return False
    delivery.next_attempt_at = None
    first_attempt = delivery.attempt == 0
    payload = delivery.payload_json if isinstance(delivery.payload_json, dict) else None
    if payload is None or delivery.webhook_id is None:
        db.commit()
        return False
    if delivery.kind == "btcpay":
        hook = (
            db.query(BtcpayWebhook)
            .filter(
                BtcpayWebhook.id == delivery.webhook_id,
                BtcpayWebhook.user_id == delivery.user_id,
            )
            .first()
        )
        # automaticRedelivery only governs retries, never the first attempt.
        if (
            hook is None
            or not hook.enabled
            or (not first_attempt and not hook.automatic_redelivery)
            or not btcpay_event_allowed(hook.authorized_events, delivery.event)
        ):
            db.commit()
            return False
        status_code, error_message = _send_with_deadline(
            delivery.user_id, send_btcpay_webhook, hook, delivery.url, payload
        )
    else:
        hook = (
            db.query(Webhook)
            .filter(
                Webhook.id == delivery.webhook_id,
                Webhook.user_id == delivery.user_id,
            )
            .first()
        )
        user = db.query(User).filter(User.id == delivery.user_id).first()
        if hook is None or not hook.active or delivery.event not in (hook.events or []) or user is None:
            db.commit()
            return False
        status_code, error_message = _send_with_deadline(
            delivery.user_id,
            send_native_webhook,
            delivery.url,
            payload,
            _ensure_webhook_secret(db, user),
            webhook_id=hook.id,
        )
    if first_attempt:
        delivery.attempt = 1
        delivery.http_status = status_code
        delivery.error_message = error_message
        if delivery.kind != "btcpay" or hook.automatic_redelivery:
            delivery.next_attempt_at = next_attempt_time(
                1, status_code, datetime.now(timezone.utc)
            )
        db.commit()
        return True
    attempt = (delivery.attempt or 1) + 1
    db.add(
        WebhookDelivery(
            user_id=delivery.user_id,
            webhook_id=delivery.webhook_id,
            kind=delivery.kind,
            event=delivery.event,
            url=delivery.url,
            invoice_id=delivery.invoice_id,
            invoice_address=delivery.invoice_address,
            invoice_subaddress_index=delivery.invoice_subaddress_index,
            invoice_amount_xmr=delivery.invoice_amount_xmr,
            invoice_status=delivery.invoice_status,
            payload_json=payload,
            http_status=status_code,
            error_message=error_message,
            attempt=attempt,
            next_attempt_at=next_attempt_time(
                attempt, status_code, datetime.now(timezone.utc)
            ),
        )
    )
    db.commit()
    return True


def _send_with_deadline(user_id: object, send, *args, **kwargs) -> tuple[int | None, str | None]:
    """Run one delivery attempt, giving up on it after DELIVERY_DEADLINE_SECONDS."""
    future = _SEND_POOL.submit(send, *args, **kwargs)
    try:
        return future.result(timeout=DELIVERY_DEADLINE_SECONDS)
    except FutureTimeout:
        _overdue_sends[str(user_id)] = future
        logger.warning("Webhook delivery timed out", extra={"user_id": str(user_id)})
        return None, "Webhook delivery timed out"


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _ensure_webhook_secret(db: Session, user: User) -> str:
    if user.webhook_secret_encrypted:
        return decrypt_secret(user.webhook_secret_encrypted)
    secret = generate_webhook_secret()
    user.webhook_secret_encrypted = encrypt_secret(secret)
    db.add(user)
    db.commit()
    db.refresh(user)
    return secret
