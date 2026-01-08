import uuid
from typing import Any
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN
import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
import requests
from requests import RequestException
from sqlalchemy import func, or_
from sqlalchemy.sql import cast
from sqlalchemy.types import String as SqlString
from sqlalchemy.orm import Session

from .config import (
    DONATION_ACTIVE_INVOICE_LIMIT,
    DONATION_EXPIRY_MINUTES,
    DONATIONS_ENABLED,
    FOUNDER_PAYMENT_ADDRESS,
    FOUNDER_VIEW_KEY,
    INVOICE_DEFAULT_EXPIRY_HOURS,
    QR_STORAGE_DIR,
)
from .db import get_db
from .formatting import format_xmr_amount
from .models import Invoice, ProfileHistory, User, Webhook, WebhookDelivery
from monero.address import Address, IntegratedAddress, SubAddress
from .rates import get_xmr_rate
from .subaddress_allocator import MAX_SUBADDRESS_INDEX, create_subaddress_for_user
from .schemas import (
    ApiCredentialsResetRequest,
    ApiCredentialsResetResponse,
    DonationCreate,
    InvoiceCreateUser,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceStatusResponse,
    LoginRequest,
    LoginResponse,
    ProfileResponse,
    ProfileUpdate,
    WebhookCreate,
    WebhookDeliveryResponse,
    WebhookResponse,
)
from .security import (
    decrypt_secret,
    decrypt_api_key,
    encrypt_secret,
    encrypt_api_key,
    generate_api_key,
    generate_webhook_secret,
    hash_api_key,
    require_api_key,
)
from .webhooks import build_webhook_payload, dispatch_webhooks
from .qr_codes import ensure_invoice_qr_png, invoice_qr_url, resolve_qr_settings

router = APIRouter()

WEBHOOK_EVENTS = (
    "invoice.created",
    "invoice.payment_detected",
    "invoice.confirmed",
    "invoice.expired",
)


def _require_donations_enabled() -> None:
    if not DONATIONS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donations are disabled",
)

MAX_QR_LOGO_DATA_URL_LENGTH = 120_000


def _get_user_for_api_key(db: Session, api_key: str) -> User | None:
    return db.query(User).filter(User.api_key_hash == hash_api_key(api_key)).first()


def _get_founder_user(db: Session) -> User:
    if not FOUNDER_PAYMENT_ADDRESS or not FOUNDER_VIEW_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Donations are not configured",
        )
    _validate_payment_address_and_view_key(FOUNDER_PAYMENT_ADDRESS, FOUNDER_VIEW_KEY)
    user = (
        db.query(User)
        .filter(User.payment_address == FOUNDER_PAYMENT_ADDRESS)
        .first()
    )
    if user is None:
        api_key = generate_api_key()
        webhook_secret = generate_webhook_secret()
        user = User(
            payment_address=FOUNDER_PAYMENT_ADDRESS,
            view_key_encrypted=encrypt_secret(FOUNDER_VIEW_KEY),
            api_key_hash=hash_api_key(api_key),
            api_key_encrypted=encrypt_api_key(api_key),
            webhook_secret_encrypted=encrypt_secret(webhook_secret),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    if decrypt_secret(user.view_key_encrypted) != FOUNDER_VIEW_KEY:
        user.view_key_encrypted = encrypt_secret(FOUNDER_VIEW_KEY)
        db.add(user)
        db.commit()
        db.refresh(user)
    _ensure_webhook_secret(db, user)
    return user


def _default_invoice_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=INVOICE_DEFAULT_EXPIRY_HOURS)


def _donation_invoice_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=DONATION_EXPIRY_MINUTES)


def _is_donation_invoice(invoice: Invoice) -> bool:
    metadata = invoice.metadata_json or {}
    return isinstance(metadata, dict) and metadata.get("origin") == "donation"


def _ensure_webhook_secret(db: Session, user: User) -> str:
    if user.webhook_secret_encrypted:
        return decrypt_secret(user.webhook_secret_encrypted)
    secret = generate_webhook_secret()
    user.webhook_secret_encrypted = encrypt_secret(secret)
    db.add(user)
    db.commit()
    db.refresh(user)
    return secret


def _resolve_webhook_payload(
    payload: WebhookCreate,
) -> tuple[str | None, list[str], dict[str, str] | None]:
    event_urls = {key: str(value) for key, value in (payload.event_urls or {}).items()}
    events = list(payload.events or [])
    if event_urls:
        for key in event_urls:
            if key not in WEBHOOK_EVENTS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Webhook event is not supported",
                )
    if events:
        for event in events:
            if event not in WEBHOOK_EVENTS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Webhook event is not supported",
                )
    events_set = set(events) | set(event_urls.keys())
    if not events_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one webhook event",
        )
    if payload.url is None and not event_urls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook URL is required",
        )
    if payload.url is None:
        missing = [event for event in events_set if event not in event_urls]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Webhook URL is required for all selected events",
            )
    ordered_events = [event for event in WEBHOOK_EVENTS if event in events_set]
    return (str(payload.url) if payload.url else None, ordered_events, event_urls or None)


def _invoice_url(invoice: Invoice, request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    if not host:
        return f"/invoice/{invoice.id}"
    return f"{proto}://{host}/invoice/{invoice.id}"


def _qr_url(invoice: Invoice, request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    path = invoice_qr_url(str(invoice.id))
    if not host:
        return path
    return f"{proto}://{host}{path}"


def _invoice_response(
    invoice: Invoice,
    request: Request,
    warnings: list[str] | None = None,
) -> InvoiceResponse:
    response = InvoiceResponse.model_validate(invoice)
    metadata = invoice.metadata_json or {}
    quote = metadata.get("quote") if isinstance(metadata, dict) else None
    qr = metadata.get("qr") if isinstance(metadata, dict) else None
    qr_logo = qr.get("logo") if isinstance(qr, dict) else None
    qr_logo_data_url = qr.get("logo_data_url") if isinstance(qr, dict) else None
    if not isinstance(qr_logo, str):
        qr_logo = None
    if qr_logo not in ("monero", "none", "custom"):
        qr_logo = None
        qr_logo_data_url = None
    if qr_logo != "custom":
        qr_logo_data_url = None
    if not isinstance(qr_logo_data_url, str):
        qr_logo_data_url = None
    return response.model_copy(
        update={
            "invoice_url": _invoice_url(invoice, request),
            "qr_url": _qr_url(invoice, request),
            "warnings": warnings,
            "quote": quote,
            "qr_logo": qr_logo,
            "qr_logo_data_url": qr_logo_data_url,
        }
    )


def _public_invoice_status_response(
    db: Session,
    invoice: Invoice,
    request: Request,
) -> InvoiceStatusResponse:
    response = InvoiceStatusResponse.model_validate(invoice)
    metadata = invoice.metadata_json or {}
    update: dict[str, Any] = {}
    if invoice.total_paid_atomic is not None:
        total_paid = (Decimal(invoice.total_paid_atomic) / Decimal("1000000000000")).quantize(
            Decimal("0.000000000001"), rounding=ROUND_DOWN
        )
        update["amount_paid_xmr"] = format_xmr_amount(total_paid)
    btcpay_data = metadata.get("btcpay") if isinstance(metadata, dict) else None
    if isinstance(btcpay_data, dict):
        amount = btcpay_data.get("amount")
        currency = btcpay_data.get("currency")
        if isinstance(amount, str) and isinstance(currency, str):
            update["btcpay_amount"] = amount
            update["btcpay_currency"] = currency
            if invoice.user_id:
                user = db.query(User).filter(User.id == invoice.user_id).first()
                if user and user.btcpay_checkout_style:
                    update["btcpay_checkout_style"] = user.btcpay_checkout_style
        checkout = btcpay_data.get("checkout")
        if isinstance(checkout, dict):
            redirect_url = checkout.get("redirectURL")
            if isinstance(redirect_url, str) and redirect_url.strip():
                update["btcpay_redirect_url"] = redirect_url.strip()
            redirect_auto = checkout.get("redirectAutomatically")
            if isinstance(redirect_auto, bool):
                update["btcpay_redirect_automatically"] = redirect_auto
    if isinstance(metadata, dict) and isinstance(metadata.get("quote"), dict):
        update["quote"] = metadata.get("quote")
    if isinstance(metadata, dict) and isinstance(metadata.get("posData"), str):
        try:
            pos_data = json.loads(metadata.get("posData", ""))
        except (TypeError, ValueError, json.JSONDecodeError):
            pos_data = None
        if isinstance(pos_data, dict):
            woo = pos_data.get("WooCommerce")
            if isinstance(woo, dict):
                order_id = woo.get("Order ID")
                order_number = woo.get("Order Number")
                if order_id is not None:
                    update["btcpay_order_id"] = str(order_id)
                if order_number is not None:
                    update["btcpay_order_number"] = str(order_number)
    qr = metadata.get("qr") if isinstance(metadata, dict) else None
    if isinstance(qr, dict):
        logo = qr.get("logo")
        logo_data_url = qr.get("logo_data_url")
        if isinstance(logo, str) and logo in ("monero", "none", "custom"):
            update["qr_logo"] = logo
            if logo == "custom" and isinstance(logo_data_url, str):
                update["qr_logo_data_url"] = logo_data_url
    update["qr_url"] = _qr_url(invoice, request)
    return response.model_copy(update=update)


def _resolve_invoice_amount(
    db: Session,
    *,
    user: User,
    requested_amount_xmr: Decimal | None = None,
    requested_amount_fiat: Decimal | None = None,
    requested_currency: str | None = None,
) -> tuple[Decimal, list[str] | None, dict[str, str] | None]:
    if requested_amount_xmr is not None:
        return requested_amount_xmr, None, None
    if requested_amount_fiat is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="amount_xmr or amount_fiat is required",
        )
    if not requested_currency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="currency is required when amount_fiat is provided",
        )
    try:
        quote = get_xmr_rate(requested_currency)
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
    amount_xmr = (Decimal(requested_amount_fiat) / quote.rate).quantize(
        Decimal("0.000000000001"), rounding=ROUND_DOWN
    )
    warnings = ["Fiat conversion is an estimate and does not lock a rate."]
    quote_payload = {
        "fiat_amount": str(requested_amount_fiat),
        "fiat_currency": quote.currency,
        "rate": str(quote.rate),
        "source": quote.source,
        "quoted_at": quote.quoted_at.isoformat(),
    }
    return amount_xmr, warnings, quote_payload


def _validate_payment_address_and_view_key(payment_address: str, view_key: str) -> None:
    try:
        address = Address(payment_address)
    except ValueError as exc:
        try:
            SubAddress(payment_address)
        except ValueError:
            try:
                IntegratedAddress(payment_address)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Primary address is invalid",
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integrated addresses are not supported. Use the primary address.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subaddresses are not supported. Use the primary address.",
        ) from exc
    if not address.check_private_view_key(view_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Secret view key does not match the primary address",
        )


@router.post(
    "/api/core/donations",
    response_model=InvoiceResponse,
    status_code=201,
    include_in_schema=False,
)
def create_donation_invoice(
    payload: DonationCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_donations_enabled()
    user = _get_founder_user(db)
    expires_at = _donation_invoice_expiry()
    active_limit = min(max(1, DONATION_ACTIVE_INVOICE_LIMIT), MAX_SUBADDRESS_INDEX)
    now = datetime.now(timezone.utc)
    active_count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.user_id == user.id,
            Invoice.status.in_(["pending", "payment_detected"]),
            or_(Invoice.expires_at.is_(None), Invoice.expires_at > now),
        )
        .scalar()
        or 0
    )
    if active_count >= active_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Donation traffic is high. Try again soon.",
        )
    resolved_amount, warnings, _ = _resolve_invoice_amount(
        db,
        user=user,
        requested_amount_xmr=payload.amount_xmr,
    )
    address, subaddress_index = create_subaddress_for_user(db, user=user)
    invoice = Invoice(
        user_id=user.id,
        wallet_address=user.payment_address,
        address=address,
        subaddress_index=subaddress_index,
        amount_xmr=resolved_amount,
        status="pending",
        confirmation_target=payload.confirmation_target,
        metadata_json={"origin": "donation"},
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
    return _invoice_response(invoice, request, warnings=warnings)


@router.get(
    "/api/core/public/invoice/{invoice_id}",
    response_model=InvoiceStatusResponse,
)
def get_invoice_status(
    invoice_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if invoice is None or _is_donation_invoice(invoice):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    try:
        ensure_invoice_qr_png(
            invoice=invoice,
            storage_dir=QR_STORAGE_DIR,
            settings=resolve_qr_settings(invoice),
        )
    except HTTPException:
        pass
    return _public_invoice_status_response(db, invoice, request)


@router.get(
    "/api/core/public/donation/{invoice_id}",
    response_model=InvoiceStatusResponse,
    include_in_schema=False,
)
def get_donation_status(
    invoice_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_donations_enabled()
    founder = _get_founder_user(db)
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if (
        invoice is None
        or not _is_donation_invoice(invoice)
        or invoice.user_id != founder.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donation invoice not found",
        )
    try:
        ensure_invoice_qr_png(
            invoice=invoice,
            storage_dir=QR_STORAGE_DIR,
            settings=resolve_qr_settings(invoice),
        )
    except HTTPException:
        pass
    return _public_invoice_status_response(db, invoice, request)


@router.post("/api/core/webhooks", response_model=WebhookResponse)
def register_webhook(
    payload: WebhookCreate,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    _ensure_webhook_secret(db, user)
    url, events, event_urls = _resolve_webhook_payload(payload)
    webhook = Webhook(
        user_id=user.id,
        url=url,
        events=events,
        event_urls=event_urls,
        active=True,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return webhook


@router.get("/api/core/webhooks", response_model=list[WebhookResponse])
def list_webhooks(
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    return (
        db.query(Webhook)
        .filter(Webhook.user_id == user.id)
        .order_by(Webhook.created_at.desc())
        .all()
    )


@router.get("/api/core/webhooks/history", response_model=list[WebhookDeliveryResponse])
def list_webhook_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    return (
        db.query(WebhookDelivery)
        .filter(WebhookDelivery.user_id == user.id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )


@router.post(
    "/api/core/webhooks/deliveries/{delivery_id}/redeliver",
    status_code=200,
)
def redeliver_webhook_delivery(
    delivery_id: uuid.UUID,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    delivery = (
        db.query(WebhookDelivery)
        .filter(WebhookDelivery.id == delivery_id, WebhookDelivery.user_id == user.id)
        .first()
    )
    if delivery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook delivery not found",
        )
    if delivery.http_status is not None and delivery.http_status < 400:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only failed deliveries can be redelivered",
        )
    payload = delivery.payload_json
    if not isinstance(payload, dict):
        payload = None
    if payload is None and delivery.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == delivery.invoice_id).first()
        if invoice is not None:
            payload = build_webhook_payload(delivery.event, invoice)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Webhook payload is unavailable for this delivery",
        )

    webhook_secret = _ensure_webhook_secret(db, user)
    status_code = None
    error_message = None
    try:
        response = requests.post(
            delivery.url,
            json=payload,
            headers={"X-Webhook-Secret": webhook_secret},
            timeout=5,
        )
        status_code = response.status_code
    except RequestException as exc:
        error_message = str(exc)

    redelivery = WebhookDelivery(
        user_id=user.id,
        webhook_id=delivery.webhook_id,
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
    )
    db.add(redelivery)
    db.commit()
    db.refresh(redelivery)
    return {
        "delivery_id": str(redelivery.id),
        "http_status": redelivery.http_status,
        "error_message": redelivery.error_message,
    }


@router.delete(
    "/api/core/webhooks/{webhook_id}",
    status_code=204,
    responses={204: {"description": "Webhook deleted"}},
)
def delete_webhook(
    webhook_id: uuid.UUID,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    webhook = (
        db.query(Webhook)
        .filter(Webhook.id == webhook_id, Webhook.user_id == user.id)
        .first()
    )
    if webhook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )
    db.delete(webhook)
    db.commit()
    return None


@router.post("/api/core/auth/login", response_model=LoginResponse)
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    payment_address = payload.payment_address.strip()
    view_key = payload.view_key.strip()
    _validate_payment_address_and_view_key(payment_address, view_key)
    user = db.query(User).filter(User.payment_address == payment_address).first()
    if user is None:
        api_key = generate_api_key()
        webhook_secret = generate_webhook_secret()
        user = User(
            payment_address=payment_address,
            view_key_encrypted=encrypt_secret(view_key),
            api_key_hash=hash_api_key(api_key),
            api_key_encrypted=encrypt_api_key(api_key),
            webhook_secret_encrypted=encrypt_secret(webhook_secret),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return {
            "api_key": api_key,
            "webhook_secret": webhook_secret,
            "store_id": user.id,
        }
    current_view_key = decrypt_secret(user.view_key_encrypted)
    if current_view_key != view_key:
        history_entry = ProfileHistory(
            user_id=user.id,
            field_name="view_key",
            old_value=user.view_key_encrypted,
            new_value=encrypt_secret(view_key),
            value_encrypted=True,
        )
        user.view_key_encrypted = encrypt_secret(view_key)
        db.add(history_entry)
        db.commit()
        db.refresh(user)
    webhook_secret = _ensure_webhook_secret(db, user)
    return {
        "api_key": decrypt_api_key(user.api_key_encrypted),
        "webhook_secret": webhook_secret,
        "store_id": user.id,
    }


@router.post("/api/core/auth/validate", status_code=status.HTTP_204_NO_CONTENT)
def validate_login(payload: LoginRequest) -> Response:
    payment_address = payload.payment_address.strip()
    view_key = payload.view_key.strip()
    _validate_payment_address_and_view_key(payment_address, view_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/api/core/api-credentials/reset",
    response_model=ApiCredentialsResetResponse,
)
def reset_api_credentials(
    payload: ApiCredentialsResetRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    if not payload.reset_api_key and not payload.reset_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one credential to reset",
        )
    response: dict[str, str] = {}
    if payload.reset_api_key:
        new_key = generate_api_key()
        new_key_encrypted = encrypt_api_key(new_key)
        history_entry = ProfileHistory(
            user_id=user.id,
            field_name="api_key",
            old_value=user.api_key_encrypted,
            new_value=new_key_encrypted,
            value_encrypted=True,
        )
        user.api_key_hash = hash_api_key(new_key)
        user.api_key_encrypted = new_key_encrypted
        db.add(history_entry)
        response["api_key"] = new_key
    if payload.reset_webhook_secret:
        new_secret = generate_webhook_secret()
        new_secret_encrypted = encrypt_secret(new_secret)
        history_entry = ProfileHistory(
            user_id=user.id,
            field_name="webhook_secret",
            old_value=user.webhook_secret_encrypted,
            new_value=new_secret_encrypted,
            value_encrypted=True,
        )
        user.webhook_secret_encrypted = new_secret_encrypted
        db.add(history_entry)
        response["webhook_secret"] = new_secret
    db.commit()
    db.refresh(user)
    return response


@router.get("/api/core/profile", response_model=ProfileResponse)
def get_profile(
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    return user


@router.patch("/api/core/profile", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    if not payload.model_fields_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one profile field to update",
        )
    if (
        "btcpay_checkout_style" in payload.model_fields_set
        and payload.btcpay_checkout_style != user.btcpay_checkout_style
    ):
        history_entry = ProfileHistory(
            user_id=user.id,
            field_name="btcpay_checkout_style",
            old_value=user.btcpay_checkout_style,
            new_value=payload.btcpay_checkout_style,
            value_encrypted=False,
        )
        user.btcpay_checkout_style = payload.btcpay_checkout_style
        db.add(history_entry)
    if (
        "default_confirmation_target" in payload.model_fields_set
        and payload.default_confirmation_target is not None
        and payload.default_confirmation_target != user.default_confirmation_target
    ):
        history_entry = ProfileHistory(
            user_id=user.id,
            field_name="default_confirmation_target",
            old_value=str(user.default_confirmation_target),
            new_value=str(payload.default_confirmation_target),
            value_encrypted=False,
        )
        user.default_confirmation_target = payload.default_confirmation_target
        db.add(history_entry)
    if "default_qr_logo" in payload.model_fields_set:
        if payload.default_qr_logo is not None and payload.default_qr_logo != user.default_qr_logo:
            history_entry = ProfileHistory(
                user_id=user.id,
                field_name="default_qr_logo",
                old_value=user.default_qr_logo,
                new_value=payload.default_qr_logo,
                value_encrypted=False,
            )
            user.default_qr_logo = payload.default_qr_logo
            db.add(history_entry)
    if "default_qr_logo_data_url" in payload.model_fields_set:
        if payload.default_qr_logo_data_url is not None:
            value = payload.default_qr_logo_data_url.strip()
            if value and len(value) > MAX_QR_LOGO_DATA_URL_LENGTH:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="QR logo image is too large",
                )
            if value == "":
                payload.default_qr_logo_data_url = None
        if payload.default_qr_logo_data_url != user.default_qr_logo_data_url:
            history_entry = ProfileHistory(
                user_id=user.id,
                field_name="default_qr_logo_data_url",
                old_value=user.default_qr_logo_data_url,
                new_value=payload.default_qr_logo_data_url,
                value_encrypted=False,
            )
            user.default_qr_logo_data_url = payload.default_qr_logo_data_url
            db.add(history_entry)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/api/core/invoices", response_model=InvoiceResponse, status_code=201)
def create_invoice_for_user(
    payload: InvoiceCreateUser,
    request: Request,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    if not user.payment_address or not user.view_key_encrypted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Primary address is not configured for this user",
        )
    confirmation_target = payload.confirmation_target
    if "confirmation_target" not in payload.model_fields_set:
        confirmation_target = user.default_confirmation_target
    expires_at = payload.expires_at or _default_invoice_expiry()
    resolved_amount, warnings, quote = _resolve_invoice_amount(
        db,
        user=user,
        requested_amount_xmr=payload.amount_xmr,
        requested_amount_fiat=payload.amount_fiat,
        requested_currency=payload.currency,
    )
    if warnings is not None and len(warnings) == 0:
        warnings = None
    metadata = payload.metadata or {}
    if quote:
        metadata = {**metadata, "quote": quote}
    if isinstance(metadata, dict):
        qr = metadata.get("qr")
        if not isinstance(qr, dict):
            qr = None
        if qr is None:
            qr = {"logo": user.default_qr_logo}
            if user.default_qr_logo == "custom" and user.default_qr_logo_data_url:
                qr["logo_data_url"] = user.default_qr_logo_data_url
            metadata = {**metadata, "qr": qr}
        else:
            logo = qr.get("logo")
            logo_data_url = qr.get("logo_data_url")
            if isinstance(logo, str) and logo in ("monero", "none", "custom"):
                normalized = {"logo": logo}
                if logo == "custom":
                    if isinstance(logo_data_url, str):
                        trimmed = logo_data_url.strip()
                        if trimmed and len(trimmed) > MAX_QR_LOGO_DATA_URL_LENGTH:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="QR logo image is too large",
                            )
                        if trimmed:
                            normalized["logo_data_url"] = trimmed
                metadata = {**metadata, "qr": normalized}
    else:
        metadata = {"qr": {"logo": user.default_qr_logo}}
        if user.default_qr_logo == "custom" and user.default_qr_logo_data_url:
            metadata["qr"]["logo_data_url"] = user.default_qr_logo_data_url
    address, subaddress_index = create_subaddress_for_user(db, user=user)
    invoice = Invoice(
        user_id=user.id,
        wallet_address=user.payment_address,
        address=address,
        subaddress_index=subaddress_index,
        amount_xmr=resolved_amount,
        status="pending",
        confirmation_target=confirmation_target,
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
    return _invoice_response(invoice, request, warnings=warnings)


@router.get("/api/core/invoices", response_model=InvoiceListResponse)
def list_invoices_for_user(
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: str | None = Query(default=None, alias="status"),
    include_archived: bool = Query(default=False, alias="include_archived"),
    q: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc"),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    query = db.query(Invoice).filter(Invoice.user_id == user.id)
    if not include_archived:
        query = query.filter(Invoice.archived_at.is_(None))
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    if q:
        needle = q.strip()
        if needle:
            try:
                invoice_uuid = uuid.UUID(needle)
            except ValueError:
                invoice_uuid = None
            matchers = []
            if invoice_uuid is not None:
                matchers.append(Invoice.id == invoice_uuid)
            matchers.append(Invoice.address.ilike(f"%{needle}%"))
            matchers.append(cast(Invoice.metadata_json, SqlString).ilike(f"%{needle}%"))
            query = query.filter(or_(*matchers))
    if created_from:
        query = query.filter(Invoice.created_at >= created_from)
    if created_to:
        query = query.filter(Invoice.created_at <= created_to)

    sort_keys = {
        "created_at": Invoice.created_at,
        "expires_at": Invoice.expires_at,
        "amount_xmr": Invoice.amount_xmr,
        "status": Invoice.status,
        "confirmations": Invoice.confirmations,
        "confirmation_target": Invoice.confirmation_target,
    }
    sort_column = sort_keys.get(sort, Invoice.created_at)
    if order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    items = (
        query.offset(offset)
        .limit(limit)
        .all()
    )
    invoice_items = [_invoice_response(invoice, request) for invoice in items]
    total_query = db.query(func.count(Invoice.id)).filter(Invoice.user_id == user.id)
    if not include_archived:
        total_query = total_query.filter(Invoice.archived_at.is_(None))
    if status_filter:
        total_query = total_query.filter(Invoice.status == status_filter)
    if q:
        needle = q.strip()
        if needle:
            try:
                invoice_uuid = uuid.UUID(needle)
            except ValueError:
                invoice_uuid = None
            matchers = []
            if invoice_uuid is not None:
                matchers.append(Invoice.id == invoice_uuid)
            matchers.append(Invoice.address.ilike(f"%{needle}%"))
            matchers.append(cast(Invoice.metadata_json, SqlString).ilike(f"%{needle}%"))
            total_query = total_query.filter(or_(*matchers))
    if created_from:
        total_query = total_query.filter(Invoice.created_at >= created_from)
    if created_to:
        total_query = total_query.filter(Invoice.created_at <= created_to)
    total = total_query.scalar() or 0
    return {"items": invoice_items, "total": total}


@router.get(
    "/api/core/invoices/export.csv",
    responses={200: {"content": {"text/csv": {}}}},
)
def export_invoices_csv(
    include_archived: bool = Query(default=False, alias="include_archived"),
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc"),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )

    query = db.query(Invoice).filter(Invoice.user_id == user.id)
    if not include_archived:
        query = query.filter(Invoice.archived_at.is_(None))
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    if q:
        needle = q.strip()
        if needle:
            try:
                invoice_uuid = uuid.UUID(needle)
            except ValueError:
                invoice_uuid = None
            matchers = []
            if invoice_uuid is not None:
                matchers.append(Invoice.id == invoice_uuid)
            matchers.append(Invoice.address.ilike(f"%{needle}%"))
            matchers.append(cast(Invoice.metadata_json, SqlString).ilike(f"%{needle}%"))
            query = query.filter(or_(*matchers))
    if created_from:
        query = query.filter(Invoice.created_at >= created_from)
    if created_to:
        query = query.filter(Invoice.created_at <= created_to)

    sort_keys = {
        "created_at": Invoice.created_at,
        "expires_at": Invoice.expires_at,
        "amount_xmr": Invoice.amount_xmr,
        "status": Invoice.status,
        "confirmations": Invoice.confirmations,
        "confirmation_target": Invoice.confirmation_target,
    }
    sort_column = sort_keys.get(sort, Invoice.created_at)
    if order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    def _row_writer():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "id",
                "status",
                "amount_xmr",
                "confirmation_target",
                "confirmations",
                "paid_after_expiry",
                "paid_after_expiry_at",
                "address",
                "subaddress_index",
                "created_at",
                "expires_at",
                "detected_at",
                "confirmed_at",
                "archived_at",
                "metadata",
            ]
        )
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        for invoice in query.yield_per(500):
            metadata = invoice.metadata_json
            if metadata is None:
                metadata_value = ""
            else:
                metadata_value = str(metadata)
            writer.writerow(
                [
                    str(invoice.id),
                    invoice.status,
                    format_xmr_amount(invoice.amount_xmr),
                    invoice.confirmation_target,
                    invoice.confirmations or 0,
                    bool(invoice.paid_after_expiry),
                    invoice.paid_after_expiry_at.isoformat()
                    if invoice.paid_after_expiry_at
                    else "",
                    invoice.address,
                    invoice.subaddress_index if invoice.subaddress_index is not None else "",
                    invoice.created_at.isoformat() if invoice.created_at else "",
                    invoice.expires_at.isoformat() if invoice.expires_at else "",
                    invoice.detected_at.isoformat() if invoice.detected_at else "",
                    invoice.confirmed_at.isoformat() if invoice.confirmed_at else "",
                    invoice.archived_at.isoformat() if invoice.archived_at else "",
                    metadata_value,
                ]
            )
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    filename = f"invoices-{datetime.now(timezone.utc).date().isoformat()}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(_row_writer(), media_type="text/csv", headers=headers)


@router.get("/api/core/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice_for_user(
    invoice_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.user_id == user.id,
            Invoice.archived_at.is_(None),
        )
        .first()
    )
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    return _invoice_response(invoice, request)


@router.delete(
    "/api/core/invoices/{invoice_id}",
    status_code=204,
    responses={204: {"description": "Invoice archived"}},
)
def archive_invoice_for_user(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.user_id == user.id,
            Invoice.archived_at.is_(None),
        )
        .first()
    )
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    if invoice.status not in ("pending", "expired", "invalid"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending, expired, or invalid invoices can be archived",
        )
    invoice.archived_at = datetime.now(timezone.utc)
    db.add(invoice)
    db.commit()
    return None
