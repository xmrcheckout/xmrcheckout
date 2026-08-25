from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from requests import RequestException
from sqlalchemy.orm import Session

from .models import BtcpayWebhook, Invoice
from .payment_timing import is_payment_after_expiry
from .security import decrypt_secret
from .webhook_http import (
    UnsafeWebhookUrl,
    post_webhook_with_redirects,
)

logger = logging.getLogger(__name__)

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
        event_type=event_type,
        user_id=user_id,
        invoice=invoice,
        manually_marked=manually_marked,
    )
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    for hook in hooks:
        if not _event_allowed(hook.authorized_events, event_type):
            continue
        try:
            secret = decrypt_secret(hook.secret_encrypted)
            signature = _sign_payload(body, secret)
            headers = {
                "BTCPay-Sig": f"sha256={signature}",
                "Content-Type": "application/json",
                "User-Agent": "xmrcheckout-btcpay-webhook/1.0",
            }
            # Retry up to 3 times with backoff on transient failures
            last_response = None
            for attempt in range(3):
                try:
                    last_response = post_webhook_with_redirects(
                        hook.url,
                        data=body,
                        headers=headers,
                        timeout=5,
                    )
                    if last_response is not None and last_response.status_code < 500:
                        break
                except RequestException:
                    if attempt == 2:
                        raise
                if attempt < 2:
                    time.sleep(1.0 * (attempt + 1))
            if last_response is None:
                logger.warning(
                    "BTCPay webhook delivery failed after retries (redirect loop)",
                    extra={"webhook_id": str(hook.id), "event": event_type, "url": hook.url},
                )
                continue
            if last_response.status_code >= 400:
                logger.warning(
                    "BTCPay webhook delivered non-success status",
                    extra={
                        "webhook_id": str(hook.id),
                        "event": event_type,
                        "http_status": last_response.status_code,
                    },
                )
        except RequestException as exc:
            logger.error(
                "BTCPay webhook delivery failed after 3 attempts: %s",
                exc,
                extra={"webhook_id": str(hook.id), "event": event_type, "url": hook.url},
            )
        except UnsafeWebhookUrl as exc:
            logger.warning(
                "BTCPay webhook delivery failed",
                extra={"webhook_id": str(hook.id), "event": event_type},
            )
        except Exception as exc:
            logger.error(
                "BTCPay webhook dispatch failed: %s",
                exc,
                extra={"webhook_id": str(hook.id), "event": event_type},
            )


def _event_allowed(authorized_events: object, event_type: str) -> bool:
    if not isinstance(authorized_events, dict):
        return False
    if authorized_events.get("everything") is True:
        return True
    specific = authorized_events.get("specificEvents") or []
    return event_type in specific


def _build_payload(
    *,
    event_type: str,
    user_id: str,
    invoice: Invoice,
    manually_marked: bool,
) -> dict[str, object]:
    return {
        "type": event_type,
        "timestamp": int(time.time()),
        "storeId": user_id,
        "invoiceId": str(invoice.id),
        "manuallyMarked": manually_marked,
        "overPaid": False,
        "partiallyPaid": False,
        "afterExpiration": is_payment_after_expiry(invoice),
        "metadata": invoice.metadata_json or {},
    }

def _sign_payload(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
