from __future__ import annotations

import logging
import uuid
from datetime import datetime

import requests
from requests import RequestException
from sqlalchemy.orm import Session

from .formatting import format_xmr_amount
from .models import Invoice, User, Webhook, WebhookDelivery
from .security import decrypt_secret, encrypt_secret, generate_webhook_secret

logger = logging.getLogger(__name__)


def build_webhook_payload(event: str, invoice: Invoice) -> dict[str, object]:
    return {
        "event": event,
        "invoice": {
            "id": str(invoice.id),
            "address": invoice.address,
            "subaddress_index": invoice.subaddress_index,
            "amount_xmr": format_xmr_amount(invoice.amount_xmr),
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
        },
    }


def dispatch_webhooks(
    db: Session,
    user_id: str,
    event: str,
    invoice: Invoice,
) -> None:
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
        status_code = None
        error_message = None
        try:
            headers = {"X-Webhook-Secret": webhook_secret} if webhook_secret else None
            response = requests.post(target_url, json=payload, headers=headers, timeout=5)
            status_code = response.status_code
        except RequestException as exc:
            error_message = str(exc)
            logger.warning(
                "Webhook delivery failed",
                extra={"webhook_id": str(hook.id), "event": event},
            )
            logger.debug("Webhook delivery error: %s", exc)
        deliveries.append(
            WebhookDelivery(
                user_id=user_uuid,
                webhook_id=hook.id,
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
            )
        )
    if deliveries:
        try:
            db.add_all(deliveries)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("Failed to save webhook delivery history", extra={"error": str(exc)})


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
