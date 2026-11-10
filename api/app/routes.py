from .public_origin import public_origin
import uuid
from uuid import UUID
from typing import Any, Literal
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN, InvalidOperation
import csv
import io
import json
import re
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse, StreamingResponse
from requests import RequestException
from sqlalchemy import func, or_
from sqlalchemy.sql import cast
from sqlalchemy.types import String as SqlString
from sqlalchemy.orm import Session

from .config import (
    INVOICE_DEFAULT_EXPIRY_HOURS,
    INVOICE_RECONCILE_INTERVAL_SECONDS,
    QR_STORAGE_DIR,
    SIGNUP_ENABLED,
)
from .db import get_db
from .formatting import atomic_to_xmr, format_xmr_amount, invoice_amounts
from .invoice_checks import AWAITING_PAYMENT_STATUSES, check_is_delayed, watched_invoice_criteria
from .invoice_limits import reserve_invoice_creation
from .models import (
    Invoice,
    InvoiceTransfer,
    PaymentLink,
    ProfileHistory,
    SystemStatus,
    User,
    Webhook,
    WebhookDelivery,
)
from monero.address import Address, IntegratedAddress, SubAddress
from monero.ed25519 import scalar_reduce
from .monero_service import MoneroWalletService
from .rates import UnsupportedCurrencyError, get_xmr_rate
from .subaddress_allocator import create_subaddress_for_user
from .subaddress_status import merchant_status
from .schemas import (
    ApiCredentialsResetRequest,
    ApiCredentialsResetResponse,
    InvoiceCreateUser,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceStatusResponse,
    InvoiceTransferResponse,
    LoginRequest,
    LoginResponse,
    ProfileResponse,
    ProfileUpdate,
    RateQuoteResponse,
    SystemStatusResponse,
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
from .webhook_http import (
    UnsafeWebhookUrl,
    post_webhook_with_redirects,
    validate_webhook_url,
)
from .qr_codes import (
    MAX_QR_LOGO_DATA_URL_LENGTH,
    ensure_invoice_qr_png,
    invoice_qr_url,
    resolve_qr_settings,
)
router = APIRouter()

WEBHOOK_EVENTS = (
    "invoice.created",
    "invoice.partially_paid",
    "invoice.payment_detected",
    "invoice.confirmed",
    "invoice.expired",
)


MONERO_CONNECTIVITY_STATUS_NAME = "monero_connectivity"


def _get_user_for_api_key(db: Session, api_key: str) -> User | None:
    return db.query(User).filter(User.api_key_hash == hash_api_key(api_key)).first()


def _status_response_from_rows(
    monero_status: SystemStatus | None,
    reconciler_status: SystemStatus | None,
) -> SystemStatusResponse:
    wallet_rpc = (
        str(monero_status.wallet_rpc)
        if monero_status and monero_status.wallet_rpc
        else "unreachable"
    )
    daemon = (
        str(monero_status.daemon)
        if monero_status and monero_status.daemon
        else "unknown"
    )
    daemon_height = monero_status.daemon_height if monero_status else None
    reconciler_state = _reconciler_state(reconciler_status)
    return SystemStatusResponse(
        wallet_rpc=wallet_rpc,
        daemon=daemon,
        reconciler=reconciler_state,
        daemon_height=daemon_height,
        invoice_reconcile_interval_seconds=INVOICE_RECONCILE_INTERVAL_SECONDS,
        last_reconcile_started_at=(
            reconciler_status.last_reconcile_started_at if reconciler_status else None
        ),
        last_reconcile_completed_at=(
            reconciler_status.last_reconcile_completed_at if reconciler_status else None
        ),
        last_reconcile_error=(
            reconciler_status.last_reconcile_error if reconciler_status else None
        ),
        last_reconcile_attempted_invoices=(
            int(reconciler_status.last_reconcile_attempted_invoices or 0)
            if reconciler_status
            else 0
        ),
        last_reconcile_succeeded_invoices=(
            int(reconciler_status.last_reconcile_succeeded_invoices or 0)
            if reconciler_status
            else 0
        ),
        last_reconcile_failed_invoices=(
            int(reconciler_status.last_reconcile_failed_invoices or 0)
            if reconciler_status
            else 0
        ),
    )


def _reconciler_state(
    reconciler_status: SystemStatus | None,
    *,
    now: datetime | None = None,
) -> str:
    if reconciler_status is None or reconciler_status.last_reconcile_started_at is None:
        return "unavailable"
    current_time = now or datetime.now(timezone.utc)
    activity_times = [reconciler_status.last_reconcile_started_at]
    if reconciler_status.last_reconcile_completed_at is not None:
        activity_times.append(reconciler_status.last_reconcile_completed_at)
    # The reconciler refreshes updated_at while a long pass is still running.
    if reconciler_status.updated_at is not None:
        activity_times.append(reconciler_status.updated_at)
    normalized_activity_times = [
        value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        for value in activity_times
    ]
    latest_activity_at = max(normalized_activity_times)
    stale_after_seconds = max(INVOICE_RECONCILE_INTERVAL_SECONDS * 3, 90)
    if current_time - latest_activity_at > timedelta(seconds=stale_after_seconds):
        return "unavailable"
    if (
        reconciler_status.last_reconcile_error
        or int(reconciler_status.last_reconcile_failed_invoices or 0) > 0
    ):
        return "degraded"
    if reconciler_status.last_reconcile_completed_at is None:
        return "unavailable"
    return "ok"


def _invoice_checking_delayed(
    db: Session,
    invoice: Invoice,
    *,
    now: datetime | None = None,
) -> bool:
    """Whether this invoice's own payment checks are behind.

    Only the reconciler being down or this invoice going unchecked counts, so
    one merchant's failing checks never show a delay to other merchants' buyers.
    """
    if invoice.status not in AWAITING_PAYMENT_STATUSES:
        return False
    current_time = now or datetime.now(timezone.utc)
    reconciler_status = (
        db.query(SystemStatus).filter(SystemStatus.name == "reconciler").first()
    )
    if _reconciler_state(reconciler_status, now=current_time) == "unavailable":
        return True
    return check_is_delayed(invoice.last_checked_at, invoice.created_at, now=current_time)


def _merchant_system_status(
    db: Session,
    user: User,
    *,
    now: datetime | None = None,
) -> SystemStatusResponse:
    """System status as one merchant should see it.

    Wallet-rpc, daemon and an unavailable reconciler are shared and shown as
    they are. Degraded and the check counts cover only this merchant's watched
    invoices, so other merchants' failures never show up here.
    """
    current_time = now or datetime.now(timezone.utc)
    shared = _load_public_system_status(db)
    watched = (
        db.query(Invoice.last_checked_at, Invoice.created_at)
        .filter(Invoice.user_id == user.id, watched_invoice_criteria(now=current_time))
        .all()
    )
    delayed = sum(
        1
        for last_checked_at, created_at in watched
        if check_is_delayed(last_checked_at, created_at, now=current_time)
    )
    checked_times = [row[0] for row in watched if row[0] is not None]
    if shared.reconciler == "unavailable":
        state = "unavailable"
    elif delayed:
        state = "degraded"
    else:
        state = "ok"
    return shared.model_copy(
        update={
            "reconciler": state,
            "last_reconcile_completed_at": (
                max(checked_times) if checked_times else shared.last_reconcile_completed_at
            ),
            # The shared error text and counts describe all merchants.
            "last_reconcile_error": None,
            "last_reconcile_attempted_invoices": len(watched),
            "last_reconcile_succeeded_invoices": len(watched) - delayed,
            "last_reconcile_failed_invoices": delayed,
        }
    )


def _load_public_system_status(db: Session) -> SystemStatusResponse:
    reconciler_status = (
        db.query(SystemStatus).filter(SystemStatus.name == "reconciler").first()
    )
    monero_status = (
        db.query(SystemStatus)
        .filter(SystemStatus.name == MONERO_CONNECTIVITY_STATUS_NAME)
        .first()
    )
    return _status_response_from_rows(monero_status, reconciler_status)


def _default_invoice_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=INVOICE_DEFAULT_EXPIRY_HOURS)


def _resolve_invoice_expiry(requested: datetime | None) -> datetime:
    """Default when omitted; times without an offset are UTC; past times are rejected."""
    if requested is None:
        return _default_invoice_expiry()
    if requested.tzinfo is None:
        requested = requested.replace(tzinfo=timezone.utc)
    if requested <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expires_at must be in the future",
        )
    return requested


def _get_confirmation_message(invoice: Invoice) -> str | None:
    """Payment-link confirmation message; callers must gate it on confirmation."""
    if not invoice.payment_link_id:
        return None
    metadata = invoice.metadata_json or {}
    checkout = metadata.get("checkout") if isinstance(metadata, dict) else None
    value = checkout.get("confirmation_message") if isinstance(checkout, dict) else None
    if not isinstance(value, str):
        return None
    return value.strip() or None


def _web_url(value: Any, *, https_only: bool = False) -> str | None:
    """Return a link from invoice metadata only when it is a plain web address.

    Metadata is supplied by API clients and these links are handed to the buyer's
    browser, so anything other than an http(s) URL with a host (javascript:, data:,
    ...) is dropped. With https_only, http is accepted only for localhost, the same
    rule as checkout_continue_url.
    """
    if not isinstance(value, str):
        return None
    url = value.strip()
    if not url or "\\" in url or any(ch.isspace() or not ch.isprintable() for ch in url):
        return None
    try:
        parts = urlsplit(url)
        host = parts.hostname
    except ValueError:
        return None
    if not host:
        return None
    if parts.scheme == "https":
        return url
    if parts.scheme == "http" and (not https_only or host in ("localhost", "127.0.0.1")):
        return url
    return None


def _get_checkout_continue_url(invoice: Invoice) -> str | None:
    metadata = invoice.metadata_json or {}
    if not isinstance(metadata, dict):
        return None
    checkout = metadata.get("checkout")
    if not isinstance(checkout, dict):
        return None
    return _web_url(checkout.get("continue_url"), https_only=True)


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
    return f"{public_origin(request)}/invoice/{invoice.id}"


def _qr_url(invoice: Invoice, request: Request) -> str:
    return f"{public_origin(request)}{invoice_qr_url(str(invoice.id))}"


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
    amount_paid_xmr, amount_remaining_xmr = invoice_amounts(invoice)
    return response.model_copy(
        update={
            "amount_paid_xmr": amount_paid_xmr,
            "amount_remaining_xmr": amount_remaining_xmr,
            "invoice_url": _invoice_url(invoice, request),
            "qr_url": _qr_url(invoice, request),
            "warnings": warnings,
            "quote": quote,
            "qr_logo": qr_logo,
            "qr_logo_data_url": qr_logo_data_url,
        }
    )


def _public_display_fields(metadata: Any) -> dict[str, str]:
    """Payee name and description for the customer's payment page.

    These come from the dashboard's "Customer display" fields and are public to
    anyone with the invoice link. BTCPay invoices keep client metadata private.
    """
    if not isinstance(metadata, dict) or "btcpay" in metadata:
        return {}
    fields: dict[str, str] = {}
    for key in ("recipient_name", "description"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            fields[key] = value.strip()
    return fields


def _public_invoice_status_response(
    db: Session,
    invoice: Invoice,
    request: Request,
) -> InvoiceStatusResponse:
    response = InvoiceStatusResponse.model_validate(invoice)
    metadata = invoice.metadata_json or {}
    update: dict[str, Any] = {}
    if invoice.total_paid_atomic is not None:
        amount_paid_xmr, amount_remaining_xmr = invoice_amounts(invoice)
        update["amount_paid_xmr"] = amount_paid_xmr
        update["amount_remaining_xmr"] = amount_remaining_xmr
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
            redirect_url = _web_url(checkout.get("redirectURL"))
            if redirect_url:
                update["btcpay_redirect_url"] = redirect_url
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
    product = metadata.get("payment_link") if isinstance(metadata, dict) else None
    if isinstance(product, dict):
        update["product_title"] = product.get("title")
        update["product_description"] = product.get("description")
    update.update(_public_display_fields(metadata))
    continue_url = _get_checkout_continue_url(invoice)
    update["checkout_continue_available"] = bool(
        invoice.status == "confirmed" and continue_url
    )
    # Never expose the message before the invoice is confirmed.
    update["confirmation_message"] = (
        _get_confirmation_message(invoice) if invoice.status == "confirmed" else None
    )
    if invoice.payment_link_id:
        link = db.query(PaymentLink).filter(PaymentLink.id == invoice.payment_link_id, PaymentLink.enabled.is_(True)).first()
        if link:
            site = public_origin(request)
            update["payment_link_url"] = f"{site}/pay/{link.token}?new=1"
    update["qr_url"] = _qr_url(invoice, request)
    update["checking_delayed"] = _invoice_checking_delayed(db, invoice)
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
    except UnsupportedCurrencyError as exc:
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
    if amount_xmr <= 0:
        raise HTTPException(
            status_code=422,
            detail="Amount is too small to convert to XMR",
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


def _validate_payment_address_and_view_key(payment_address: str, view_key: str) -> str:
    """Check the primary address and secret view key; return the key in lowercase.

    check_private_view_key also accepts the key written as itself plus a multiple of
    the group order, or with its top bit set. Those forms derive different
    subaddresses, so only the reduced form that wallets export is accepted.
    """
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
    normalized = view_key.strip().lower()
    if (
        not re.fullmatch(r"[0-9a-f]{64}", normalized)
        or scalar_reduce(bytes.fromhex(normalized)) != bytes.fromhex(normalized)
        or not address.check_private_view_key(normalized)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Secret view key does not match the primary address",
        )
    return normalized


@router.get(
    "/api/core/public/invoice/{invoice_id}",
    response_model=InvoiceStatusResponse,
)
def get_invoice_status(
    invoice_id: uuid.UUID,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if invoice is None:
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
    "/api/core/public/invoice/{invoice_id}/continue",
    response_class=RedirectResponse,
)
def continue_invoice_after_confirmation(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    if invoice.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Continue link not available",
        )
    continue_url = _get_checkout_continue_url(invoice)
    if not continue_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Continue link not available",
        )
    response = RedirectResponse(url=continue_url, status_code=status.HTTP_302_FOUND)
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/api/core/public/system/status", response_model=SystemStatusResponse)
def get_public_system_status(db: Session = Depends(get_db)):
    return _load_public_system_status(db)


@router.get("/api/core/system/status", response_model=SystemStatusResponse)
def get_merchant_system_status(
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(401, "User API key required")
    return _merchant_system_status(db, user)


@router.get(
    "/api/core/public/rates/{currency}",
    response_model=RateQuoteResponse,
)
def get_public_xmr_rate(currency: str, response: Response):
    normalized_currency = currency.strip().upper()
    if len(normalized_currency) != 3 or not normalized_currency.isalpha():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Currency must be a three-letter code",
        )
    try:
        quote = get_xmr_rate(normalized_currency)
    except UnsupportedCurrencyError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported fiat currency",
        ) from exc
    except (RuntimeError, RequestException, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fiat quote service unavailable",
        ) from exc
    response.headers["Cache-Control"] = "public, max-age=60"
    return RateQuoteResponse(
        currency=quote.currency,
        rate=quote.rate,
        source=quote.source,
        quoted_at=quote.quoted_at,
    )


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
    try:
        for target_url in [url, *(event_urls or {}).values()]:
            if target_url:
                validate_webhook_url(target_url)
    except UnsafeWebhookUrl as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
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
        .filter(WebhookDelivery.user_id == user.id, WebhookDelivery.kind == "native")
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
        .filter(
            WebhookDelivery.id == delivery_id,
            WebhookDelivery.user_id == user.id,
            WebhookDelivery.kind == "native",
        )
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
    if delivery.attempt == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This delivery is queued and has not been attempted yet",
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
        body = json.dumps(
            payload,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
        response = post_webhook_with_redirects(
            delivery.url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Secret": webhook_secret,
            },
            timeout=5,
        )
        if response is None:
            raise RequestException("Webhook redirect limit exceeded")
        status_code = response.status_code
    except (RequestException, UnsafeWebhookUrl) as exc:
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
    # An explicit redelivery replaces any pending automatic retry.
    delivery.next_attempt_at = None
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
    view_key = _validate_payment_address_and_view_key(payment_address, payload.view_key)
    user = db.query(User).filter(User.payment_address == payment_address).first()
    if user is None:
        if not SIGNUP_ENABLED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="New accounts are not accepted on this instance.",
            )
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
    # The stored text also names the merchant's wallet file, so a key that differs
    # only in letter case is kept as it is. A different key replaces it.
    current_view_key = decrypt_secret(user.view_key_encrypted)
    if current_view_key.lower() != view_key:
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
    _validate_payment_address_and_view_key(payment_address, payload.view_key)
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


@router.get("/api/core/subaddresses/status")
def get_subaddress_status(
    response: Response,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(401, "User API key required")
    response.headers["Cache-Control"] = "no-store"
    try:
        return merchant_status(db, user)
    except Exception:
        raise HTTPException(503, "Invoice address availability is unavailable",
                            headers={"Cache-Control": "no-store"}) from None


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
    return create_invoice_for_merchant(payload, request, db, user)


def create_invoice_for_merchant(
    payload: InvoiceCreateUser, request: Request, db: Session, user: User,
    *, payment_link_id: UUID | None = None, payment_link_attempt_id: UUID | None = None,
    minimum_amount_xmr: Decimal | None = None,
    terminal_id: UUID | None = None, terminal_attempt_id: UUID | None = None,
):
    """Shared native/public creation; callers establish merchant authorization."""
    confirmation_target = payload.confirmation_target
    if "confirmation_target" not in payload.model_fields_set:
        confirmation_target = user.default_confirmation_target
    expires_at = _resolve_invoice_expiry(payload.expires_at)
    resolved_amount, warnings, quote = _resolve_invoice_amount(
        db,
        user=user,
        requested_amount_xmr=payload.amount_xmr,
        requested_amount_fiat=payload.amount_fiat,
        requested_currency=payload.currency,
    )
    # Checked before any allowance or address is reserved.
    if minimum_amount_xmr is not None and resolved_amount < minimum_amount_xmr:
        raise HTTPException(
            status_code=422,
            detail=f"The amount is below this link's minimum of {format(minimum_amount_xmr.normalize(), 'f')} XMR.",
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
    if payload.checkout_continue_url is not None:
        checkout = metadata.get("checkout") if isinstance(metadata, dict) else None
        if not isinstance(checkout, dict):
            checkout = {}
        checkout = {**checkout, "continue_url": str(payload.checkout_continue_url)}
        metadata = {**(metadata if isinstance(metadata, dict) else {}), "checkout": checkout}
    user = reserve_invoice_creation(db, user=user)
    invoice_id = uuid.uuid4()
    address, subaddress_index = create_subaddress_for_user(db, user=user, invoice_id=invoice_id)
    invoice = Invoice(
        id=invoice_id,
        payment_link_id=payment_link_id,
        payment_link_attempt_id=payment_link_attempt_id,
        terminal_id=terminal_id,
        terminal_attempt_id=terminal_attempt_id,
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


InvoiceSourceFilter = Literal["payment_link", "terminal", "direct"]


def _filter_merchant_invoices(
    query, *, include_archived, status_filter, active_only, q, created_from, created_to,
    source=None,
):
    """Filters shared by the invoice list, its total and the CSV export."""
    # The link and terminal ids stay on an invoice after the link or terminal is deleted.
    if source == "payment_link":
        query = query.filter(Invoice.payment_link_id.isnot(None))
    elif source == "terminal":
        query = query.filter(Invoice.terminal_id.isnot(None))
    elif source == "direct":
        query = query.filter(Invoice.payment_link_id.is_(None), Invoice.terminal_id.is_(None))
    if not include_archived:
        query = query.filter(Invoice.archived_at.is_(None))
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    if active_only:
        query = query.filter(
            Invoice.status.in_(["pending", "partially_paid", "payment_detected", "confirmed"])
        )
    needle = q.strip() if q else ""
    if needle:
        matchers = []
        try:
            matchers.append(Invoice.id == uuid.UUID(needle))
        except ValueError:
            pass
        try:
            amount_xmr = Decimal(needle)
        except (InvalidOperation, ValueError):
            amount_xmr = None
        if amount_xmr is not None and amount_xmr.is_finite():
            matchers.append(Invoice.amount_xmr == amount_xmr)
        matchers.append(Invoice.address.ilike(f"%{needle}%"))
        matchers.append(cast(Invoice.metadata_json, SqlString).ilike(f"%{needle}%"))
        query = query.filter(or_(*matchers))
    if created_from:
        query = query.filter(Invoice.created_at >= created_from)
    if created_to:
        query = query.filter(Invoice.created_at <= created_to)
    return query


@router.get("/api/core/invoices", response_model=InvoiceListResponse)
def list_invoices_for_user(
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: str | None = Query(default=None, alias="status"),
    active_only: bool = Query(default=False, alias="active_only"),
    include_archived: bool = Query(default=False, alias="include_archived"),
    q: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc"),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    source: InvoiceSourceFilter | None = Query(default=None),
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    filters = dict(
        include_archived=include_archived, status_filter=status_filter, active_only=active_only,
        q=q, created_from=created_from, created_to=created_to, source=source,
    )
    query = _filter_merchant_invoices(
        db.query(Invoice).filter(Invoice.user_id == user.id), **filters
    )

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
    total_query = _filter_merchant_invoices(
        db.query(func.count(Invoice.id)).filter(
            Invoice.user_id == user.id,
        ),
        **filters,
    )
    total = total_query.scalar() or 0
    return {"items": invoice_items, "total": total}


@router.get(
    "/api/core/invoices/export.csv",
    responses={200: {"content": {"text/csv": {}}}},
)
def export_invoices_csv(
    include_archived: bool = Query(default=False, alias="include_archived"),
    status_filter: str | None = Query(default=None, alias="status"),
    active_only: bool = Query(default=False, alias="active_only"),
    q: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc"),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    source: InvoiceSourceFilter | None = Query(default=None),
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )

    query = _filter_merchant_invoices(
        db.query(Invoice).filter(Invoice.user_id == user.id),
        include_archived=include_archived, status_filter=status_filter, active_only=active_only,
        q=q, created_from=created_from, created_to=created_to, source=source,
    )

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
                "amount_paid_xmr",
                "amount_remaining_xmr",
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
            amount_paid_xmr, amount_remaining_xmr = invoice_amounts(invoice)
            metadata = invoice.metadata_json
            if metadata is None:
                metadata_value = ""
            else:
                metadata_value = json.dumps(metadata, ensure_ascii=False)
            writer.writerow(
                [
                    str(invoice.id),
                    invoice.status,
                    format_xmr_amount(invoice.amount_xmr),
                    amount_paid_xmr,
                    amount_remaining_xmr,
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


def _get_merchant_invoice_for_transfers(
    db: Session,
    api_key: str,
    invoice_id: uuid.UUID,
) -> tuple[User, Invoice]:
    user = _get_user_for_api_key(db, api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User API key required",
        )
    # Archived invoices stay available because a dispute can come later.
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.user_id == user.id,
        )
        .first()
    )
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    return user, invoice


@router.get(
    "/api/core/invoices/{invoice_id}/transfers",
    response_model=list[InvoiceTransferResponse],
)
def list_invoice_transfers(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key),
):
    _, invoice = _get_merchant_invoice_for_transfers(db, api_key, invoice_id)
    rows = (
        db.query(InvoiceTransfer)
        .filter(InvoiceTransfer.invoice_id == invoice.id, InvoiceTransfer.amount_atomic > 0)
        .order_by(InvoiceTransfer.timestamp.asc().nulls_last(), InvoiceTransfer.txid.asc())
        .all()
    )
    return [
        InvoiceTransferResponse(
            txid=row.txid,
            amount_xmr=format_xmr_amount(atomic_to_xmr(row.amount_atomic)),
            confirmations=row.confirmations,
            timestamp=row.timestamp,
        )
        for row in rows
    ]


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
