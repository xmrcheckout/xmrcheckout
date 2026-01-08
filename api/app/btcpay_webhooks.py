from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from requests import RequestException
from sqlalchemy.orm import Session

from .models import BtcpayWebhook, Invoice
from .security import decrypt_secret

logger = logging.getLogger(__name__)

_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


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
            response = _post_with_redirects(
                hook.url,
                data=body,
                headers=headers,
                timeout=5,
            )
            if response is None:
                continue
            if response.status_code >= 400:
                logger.warning(
                    "BTCPay webhook delivered non-success status",
                    extra={
                        "webhook_id": str(hook.id),
                        "event": event_type,
                        "http_status": response.status_code,
                    },
                )
        except RequestException as exc:
            logger.warning(
                "BTCPay webhook delivery failed",
                extra={"webhook_id": str(hook.id), "event": event_type},
            )
            logger.debug("BTCPay webhook delivery error: %s", exc)
        except Exception as exc:
            logger.warning(
                "BTCPay webhook dispatch failed",
                extra={"webhook_id": str(hook.id), "event": event_type, "error": str(exc)},
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
        "afterExpiration": _after_expiration(invoice),
        "metadata": invoice.metadata_json or {},
    }


def _after_expiration(invoice: Invoice) -> bool:
    expires_at = invoice.expires_at
    detected_at = invoice.detected_at
    if expires_at is None or detected_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if detected_at.tzinfo is None:
        detected_at = detected_at.replace(tzinfo=timezone.utc)
    return detected_at > expires_at


def _sign_payload(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _post_with_redirects(
    url: str,
    *,
    data: bytes,
    headers: dict[str, str],
    timeout: int,
    max_redirects: int = 3,
) -> requests.Response | None:
    current_url = url
    for _ in range(max_redirects + 1):
        response = requests.post(
            current_url,
            data=data,
            headers=headers,
            timeout=timeout,
            allow_redirects=False,
        )
        if response.status_code not in _REDIRECT_STATUSES:
            return response
        location = response.headers.get("Location")
        if not location:
            return response
        current_url = urljoin(current_url, location)
    return None
