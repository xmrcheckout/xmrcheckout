from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .btcpay_schemas import (
    BtcpayInvoiceCreate,
    BtcpayInvoiceStatusUpdate,
    BtcpayWebhookCreate,
    BtcpayWebhookUpdate,
)
from .btcpay_webhooks import dispatch_btcpay_webhooks
from .config import INVOICE_DEFAULT_EXPIRY_HOURS
from .config import QR_STORAGE_DIR
from .db import get_db
from .formatting import format_xmr_amount
from .models import BtcpayWebhook, Invoice, InvoiceTransfer, User
from .rates import get_xmr_rate
from .security import (
    decrypt_api_key,
    encrypt_secret,
    generate_webhook_secret,
    hash_api_key,
    require_api_key,
)
from .subaddress_allocator import create_subaddress_for_user
from .webhooks import dispatch_webhooks
from .qr_codes import ensure_invoice_qr_png, resolve_qr_settings

router = APIRouter()

BTCPAY_PAYMENT_METHOD = "XMR-CHAIN"
BTCPAY_PAYMENT_METHOD_ALIASES = {BTCPAY_PAYMENT_METHOD, "XMR", "XMR_CHAIN"}
BTCPAY_WEBHOOK_EVENTS = {
    "InvoiceReceivedPayment",
    "InvoicePaymentSettled",
    "InvoiceProcessing",
    "InvoiceExpired",
    "InvoiceSettled",
    "InvoiceInvalid",
}


def _require_btcpay_user(
    api_key: str = Depends(require_api_key),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.api_key_hash == hash_api_key(api_key)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    return user


def _require_store(store_id: str, user: User) -> str:
    if store_id != str(user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found",
        )
    return store_id


def _store_payload(user: User) -> dict[str, Any]:
    expiry_minutes = max(1, INVOICE_DEFAULT_EXPIRY_HOURS * 60)
    return {
        "id": str(user.id),
        "name": "XMR Checkout",
        "website": "",
        "defaultCurrency": "XMR",
        "invoiceExpiration": expiry_minutes,
        "displayExpirationTimer": True,
        "monitoringExpiration": expiry_minutes,
        "speedPolicy": "MediumSpeed",
        "paymentTolerance": 0,
        "anyoneCanCreateInvoice": False,
        "requiresRefundEmail": False,
        "lightningAmountInSatoshi": False,
        "lightningPrivateRouteHints": False,
        "onChainWithLnInvoiceFallback": False,
        "redirectAutomatically": False,
        "showRecommendedFee": False,
        "recommendedFeeBlockTarget": 0,
        "defaultLang": "en",
        "customLogo": "",
        "customCSS": "",
        "htmlTitle": "XMR Checkout",
        "networkFeeMode": "Never",
        "payJoinEnabled": False,
        "lazyPaymentMethods": False,
        "defaultPaymentMethod": BTCPAY_PAYMENT_METHOD,
    }


def _invoice_checkout_link(invoice: Invoice, request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    if not host:
        return f"/i/{invoice.id}"
    return f"{proto}://{host}/i/{invoice.id}"


def _normalize_btcpay_payment_method(value: str) -> str:
    normalized = value.strip().upper()
    if normalized in BTCPAY_PAYMENT_METHOD_ALIASES:
        return BTCPAY_PAYMENT_METHOD
    return normalized


def _epoch_seconds(value: datetime | None) -> int:
    if value is None:
        return 0
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp())


def _resolve_btcpay_amount(
    amount: Decimal,
    currency: str,
) -> tuple[Decimal, dict[str, str] | None]:
    if currency.upper() == "XMR":
        return amount, None
    try:
        quote = get_xmr_rate(currency)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fiat quote service unavailable",
        ) from exc
    amount_xmr = (Decimal(amount) / quote.rate).quantize(
        Decimal("0.000000000001"), rounding=ROUND_DOWN
    )
    quote_payload = {
        "fiat_amount": str(amount),
        "fiat_currency": quote.currency,
        "rate": str(quote.rate),
        "source": quote.source,
        "quoted_at": quote.quoted_at.isoformat(),
    }
    return amount_xmr, quote_payload


def _btcpay_status(invoice: Invoice) -> tuple[str, str]:
    additional_status = _btcpay_additional_status(invoice)
    if invoice.status == "payment_detected":
        return "Processing", additional_status
    if invoice.status == "confirmed":
        return "Settled", additional_status
    if invoice.status == "expired":
        return "Expired", additional_status
    if invoice.status == "invalid":
        return "Invalid", additional_status
    return "New", additional_status


def _btcpay_additional_status(invoice: Invoice) -> str:
    if invoice.status == "invalid":
        return "Marked"
    paid_atomic = invoice.total_paid_atomic or 0
    required_atomic = _xmr_to_atomic(invoice.amount_xmr)
    if paid_atomic > required_atomic:
        return "PaidOver"
    if 0 < paid_atomic < required_atomic:
        return "PaidPartial"
    if _after_expiration(invoice):
        return "PaidLate"
    return "None"


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


def _xmr_to_atomic(amount: Decimal) -> int:
    quantized = (Decimal(amount) * Decimal("1000000000000")).to_integral_value(
        rounding=ROUND_DOWN
    )
    return int(quantized)


def _btcpay_amount_currency(invoice: Invoice) -> tuple[str, str, dict[str, Any]]:
    metadata = invoice.metadata_json or {}
    btcpay_data = metadata.get("btcpay") if isinstance(metadata, dict) else None
    if isinstance(btcpay_data, dict):
        amount = btcpay_data.get("amount")
        currency = btcpay_data.get("currency")
        if isinstance(amount, str) and isinstance(currency, str):
            return amount, currency, btcpay_data
    return format_xmr_amount(invoice.amount_xmr), "XMR", {}


def _format_xmr_fixed(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.000000000001')):.12f}"


def _atomic_to_xmr(value: int) -> Decimal:
    return (Decimal(value) / Decimal("1000000000000")).quantize(
        Decimal("0.000000000001"), rounding=ROUND_DOWN
    )


@router.get("/api/v1/stores")
def list_stores(user: User = Depends(_require_btcpay_user)):
    return [_store_payload(user)]


@router.get("/api/v1/stores/{store_id}")
def get_store(store_id: str, user: User = Depends(_require_btcpay_user)):
    _require_store(store_id, user)
    return _store_payload(user)


@router.get("/api/v1/stores/{store_id}/payment-methods")
def list_payment_methods(store_id: str, user: User = Depends(_require_btcpay_user)):
    _require_store(store_id, user)
    return [
        {
            "paymentMethodId": BTCPAY_PAYMENT_METHOD,
            "paymentMethod": BTCPAY_PAYMENT_METHOD,
            "enabled": True,
            "cryptoCode": "XMR",
        }
    ]


@router.post("/api/v1/stores/{store_id}/invoices", status_code=200)
def create_invoice(
    store_id: str,
    payload: BtcpayInvoiceCreate,
    request: Request,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    checkout = payload.checkout
    payment_methods = (
        [_normalize_btcpay_payment_method(method) for method in checkout.paymentMethods]
        if checkout and checkout.paymentMethods
        else None
    )
    if payment_methods and BTCPAY_PAYMENT_METHOD not in payment_methods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported payment method",
        )
    amount_xmr, quote_payload = _resolve_btcpay_amount(payload.amount, payload.currency)
    expires_at = None
    now = datetime.now(timezone.utc)
    expiration_minutes = None
    monitoring_minutes = None
    if checkout and checkout.expirationMinutes:
        expiration_minutes = int(checkout.expirationMinutes)
    if expiration_minutes:
        expires_at = now + timedelta(minutes=expiration_minutes)
    else:
        expires_at = now + timedelta(hours=INVOICE_DEFAULT_EXPIRY_HOURS)
    if checkout and checkout.monitoringMinutes is not None:
        monitoring_minutes = int(checkout.monitoringMinutes)
    metadata: dict[str, Any] = dict(payload.metadata or {})
    btcpay_data = metadata.get("btcpay") if isinstance(metadata.get("btcpay"), dict) else {}
    btcpay_data = dict(btcpay_data)
    btcpay_data.update(
        {
            "amount": str(payload.amount),
            "currency": payload.currency,
            "checkout": checkout.model_dump(mode="json") if checkout else None,
            "expiration_minutes": expiration_minutes,
            "monitoring_minutes": monitoring_minutes,
        }
    )
    metadata["btcpay"] = btcpay_data
    if quote_payload and "quote" not in metadata:
        metadata["quote"] = quote_payload
    qr = metadata.get("qr")
    if not isinstance(qr, dict):
        qr = {"logo": user.default_qr_logo}
        if user.default_qr_logo == "custom" and user.default_qr_logo_data_url:
            qr["logo_data_url"] = user.default_qr_logo_data_url
        metadata["qr"] = qr
    address, subaddress_index = create_subaddress_for_user(db, user=user)
    invoice = Invoice(
        user_id=user.id,
        wallet_address=user.payment_address,
        address=address,
        subaddress_index=subaddress_index,
        amount_xmr=amount_xmr,
        status="pending",
        confirmation_target=user.default_confirmation_target,
        total_paid_atomic=0,
        metadata_json=metadata,
        expires_at=expires_at,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    try:
        ensure_invoice_qr_png(
            invoice=invoice,
            storage_dir=QR_STORAGE_DIR,
            settings=resolve_qr_settings(invoice),
        )
    except HTTPException:
        pass
    dispatch_webhooks(db, str(user.id), "invoice.created", invoice)
    status_name, additional_status = _btcpay_status(invoice)
    amount, currency, _ = _btcpay_amount_currency(invoice)
    expiration_time = _epoch_seconds(invoice.expires_at)
    monitoring_time = expiration_time
    if monitoring_minutes is None:
        monitoring_minutes = 60
    monitoring_time = expiration_time + int(monitoring_minutes * 60)
    return {
        "id": str(invoice.id),
        "amount": amount,
        "currency": currency,
        "type": "Standard",
        "checkoutLink": _invoice_checkout_link(invoice, request),
        "createdTime": _epoch_seconds(invoice.created_at),
        "expirationTime": expiration_time,
        "monitoringTime": monitoring_time,
        "archived": False,
        "status": status_name,
        "additionalStatus": additional_status,
        "availableStatusesForManualMarking": ["Invalid"],
    }


@router.get("/api/v1/stores/{store_id}/invoices/{invoice_id}")
def get_invoice(
    store_id: str,
    invoice_id: str,
    request: Request,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    try:
        invoice_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_uuid, Invoice.user_id == user.id)
        .first()
    )
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    status_name, additional_status = _btcpay_status(invoice)
    amount, currency, btcpay_data = _btcpay_amount_currency(invoice)
    expiration_time = _epoch_seconds(invoice.expires_at)
    monitoring_minutes = (
        btcpay_data.get("monitoring_minutes")
        if isinstance(btcpay_data, dict)
        else None
    )
    if monitoring_minutes is None:
        monitoring_minutes = 60
    monitoring_time = expiration_time + int(int(monitoring_minutes) * 60)
    return {
        "id": str(invoice.id),
        "amount": amount,
        "currency": currency,
        "type": "Standard",
        "checkoutLink": _invoice_checkout_link(invoice, request),
        "createdTime": _epoch_seconds(invoice.created_at),
        "expirationTime": expiration_time,
        "monitoringTime": monitoring_time,
        "archived": invoice.archived_at is not None,
        "status": status_name,
        "additionalStatus": additional_status,
        "availableStatusesForManualMarking": ["Invalid"],
    }


@router.get("/api/v1/stores/{store_id}/invoices/{invoice_id}/payment-methods")
def get_invoice_payment_methods(
    store_id: str,
    invoice_id: str,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    try:
        invoice_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_uuid, Invoice.user_id == user.id)
        .first()
    )
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    transfers = (
        db.query(InvoiceTransfer)
        .filter(InvoiceTransfer.invoice_id == invoice.id)
        .order_by(InvoiceTransfer.created_at.asc())
        .all()
    )
    total_atomic = sum(
        transfer.amount_atomic for transfer in transfers if transfer.amount_atomic > 0
    )
    total_paid = _atomic_to_xmr(total_atomic)
    due = max(Decimal("0"), invoice.amount_xmr - total_paid)
    metadata = invoice.metadata_json or {}
    quote = metadata.get("quote") if isinstance(metadata, dict) else None
    rate_value = "0"
    if isinstance(quote, dict) and "rate" in quote:
        rate_value = str(quote.get("rate", "0"))
    payments = []
    created_fallback = _epoch_seconds(invoice.created_at)
    for transfer in transfers:
        if transfer.amount_atomic <= 0:
            continue
        confirmations = transfer.confirmations
        status_label = (
            "confirmed"
            if confirmations >= max(0, invoice.confirmation_target)
            else "pending"
        )
        payments.append(
            {
                "id": f"{transfer.txid}-0",
                "value": _format_xmr_fixed(_atomic_to_xmr(transfer.amount_atomic)),
                "fee": "0",
                "destination": transfer.address or invoice.address,
                "status": status_label,
                "receivedDate": transfer.timestamp or created_fallback,
            }
        )
    return [
        {
            "paymentMethodId": BTCPAY_PAYMENT_METHOD,
            "paymentMethod": BTCPAY_PAYMENT_METHOD,
            "cryptoCode": "XMR",
            "destination": invoice.address,
            "rate": rate_value,
            "amount": _format_xmr_fixed(invoice.amount_xmr),
            "due": _format_xmr_fixed(due),
            "totalPaid": _format_xmr_fixed(total_paid),
            "paymentMethodPaid": _format_xmr_fixed(total_paid),
            "networkFee": "0",
            "payments": payments,
        }
    ]


@router.post("/api/v1/stores/{store_id}/invoices/{invoice_id}/status", status_code=200)
def mark_invoice_status(
    store_id: str,
    invoice_id: str,
    payload: BtcpayInvoiceStatusUpdate,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    if payload.status.strip().lower() != "invalid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported status",
        )
    try:
        invoice_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_uuid, Invoice.user_id == user.id)
        .first()
    )
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    if invoice.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Confirmed invoices cannot be marked invalid",
        )
    invoice.status = "invalid"
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    dispatch_btcpay_webhooks(
        db,
        str(user.id),
        "InvoiceInvalid",
        invoice,
        manually_marked=True,
    )
    return {"status": "Invalid"}


@router.post("/api/v1/stores/{store_id}/webhooks", status_code=200)
def create_webhook(
    store_id: str,
    payload: BtcpayWebhookCreate,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    _validate_webhook_events(payload.authorizedEvents.specificEvents)
    secret = generate_webhook_secret()
    webhook = BtcpayWebhook(
        user_id=user.id,
        url=str(payload.url),
        enabled=payload.enabled,
        automatic_redelivery=payload.automaticRedelivery,
        authorized_events=payload.authorizedEvents.model_dump(),
        secret_encrypted=encrypt_secret(secret),
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return _webhook_response(webhook, include_secret=True, secret=secret)


@router.get("/api/v1/stores/{store_id}/webhooks")
def list_webhooks(
    store_id: str,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    hooks = (
        db.query(BtcpayWebhook)
        .filter(BtcpayWebhook.user_id == user.id)
        .order_by(BtcpayWebhook.created_at.desc())
        .all()
    )
    return [_webhook_response(hook) for hook in hooks]


@router.get("/api/v1/stores/{store_id}/webhooks/{webhook_id}")
def get_webhook(
    store_id: str,
    webhook_id: str,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    hook = _get_webhook(db, webhook_id, user)
    return _webhook_response(hook)


@router.put("/api/v1/stores/{store_id}/webhooks/{webhook_id}")
def update_webhook(
    store_id: str,
    webhook_id: str,
    payload: BtcpayWebhookUpdate,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    hook = _get_webhook(db, webhook_id, user)
    if payload.authorizedEvents and payload.authorizedEvents.specificEvents:
        _validate_webhook_events(payload.authorizedEvents.specificEvents)
    if payload.enabled is not None:
        hook.enabled = payload.enabled
    if payload.automaticRedelivery is not None:
        hook.automatic_redelivery = payload.automaticRedelivery
    if payload.url is not None:
        hook.url = str(payload.url)
    if payload.authorizedEvents is not None:
        hook.authorized_events = payload.authorizedEvents.model_dump()
    db.add(hook)
    db.commit()
    db.refresh(hook)
    return _webhook_response(hook)


@router.delete(
    "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
    status_code=204,
)
def delete_webhook(
    store_id: str,
    webhook_id: str,
    user: User = Depends(_require_btcpay_user),
    db: Session = Depends(get_db),
):
    _require_store(store_id, user)
    hook = _get_webhook(db, webhook_id, user)
    db.delete(hook)
    db.commit()
    return None


@router.get("/api/v1/server/info")
def server_info():
    return {
        "version": "1.7.5",
        "onion": None,
        "fullySynched": True,
        "supportedPaymentMethods": [BTCPAY_PAYMENT_METHOD],
    }


@router.get("/api/v1/api-keys/current")
def api_key_current(
    user: User = Depends(_require_btcpay_user),
):
    store_id = str(user.id)
    return {
        "apiKey": decrypt_api_key(user.api_key_encrypted),
        "label": "XMR Checkout",
        "permissions": [
            f"btcpay.store.canviewinvoices:{store_id}",
            f"btcpay.store.cancreateinvoice:{store_id}",
            f"btcpay.store.canviewstoresettings:{store_id}",
            f"btcpay.store.canmodifyinvoices:{store_id}",
            f"btcpay.store.webhooks.canmodifywebhooks:{store_id}",
        ],
    }


def _get_webhook(db: Session, webhook_id: str, user: User) -> BtcpayWebhook:
    try:
        webhook_uuid = uuid.UUID(webhook_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )
    hook = (
        db.query(BtcpayWebhook)
        .filter(BtcpayWebhook.id == webhook_uuid, BtcpayWebhook.user_id == user.id)
        .first()
    )
    if hook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )
    return hook


def _validate_webhook_events(events: list[str] | None) -> None:
    if not events:
        return
    for event in events:
        if event not in BTCPAY_WEBHOOK_EVENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Webhook event is not supported",
            )


def _webhook_response(
    hook: BtcpayWebhook,
    *,
    include_secret: bool = False,
    secret: str | None = None,
) -> dict[str, Any]:
    payload = {
        "id": str(hook.id),
        "enabled": hook.enabled,
        "automaticRedelivery": hook.automatic_redelivery,
        "url": hook.url,
        "authorizedEvents": hook.authorized_events,
    }
    if include_secret and secret:
        payload["secret"] = secret
    return payload
