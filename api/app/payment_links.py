"""Merchant-owned reusable invoice templates. Public requests never use cookies."""
import html
import json
import logging
import math
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import parse_qs
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from starlette.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlalchemy.orm import Session

from .db import SessionLocal, get_db
from .models import Invoice, PaymentLink, User
from .routes import _get_user_for_api_key, create_invoice_for_merchant
from .schemas import InvoiceCreateUser
from .security import require_api_key
from .public_origin import public_origin

router = APIRouter()
logger = logging.getLogger(__name__)
PUBLIC_PAYMENT_LINK_DAILY_LIMIT = max(1, int(os.getenv("PUBLIC_PAYMENT_LINK_DAILY_LIMIT", "10")))

SUPPORTED_CURRENCIES = ("USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "HKD", "SGD", "INR", "BRL", "MXN", "SEK", "NOK", "DKK", "ZAR", "PLN", "KRW")


class PaymentLinkState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool


class PaymentLinkInput(InvoiceCreateUser):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    confirmation_target: int | None = Field(default=None, ge=0, le=10)
    enabled: bool = True
    auto_create_invoice: bool = False
    button_text: str = Field(default="Buy with Monero", min_length=1, max_length=32)
    confirmation_message: str | None = Field(default=None, max_length=2000)
    customer_amount: bool = False
    minimum_amount_xmr: Decimal | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def _validate_amounts(self):
        # Overrides InvoiceCreateUser: customer-entered links store no amount.
        if self.customer_amount:
            if self.amount_xmr is not None or self.amount_fiat is not None or self.currency is not None:
                raise ValueError("Remove the fixed amount when the customer enters the amount")
            if self.auto_create_invoice:
                raise ValueError("Automatic invoice creation needs a fixed amount")
            return self
        if self.minimum_amount_xmr is not None:
            raise ValueError("A minimum applies only when the customer enters the amount")
        if self.amount_xmr is None and self.amount_fiat is None:
            raise ValueError("amount_xmr or amount_fiat is required")
        if self.amount_xmr is not None and self.amount_fiat is not None:
            raise ValueError("Provide either amount_xmr or amount_fiat, not both")
        if self.amount_fiat is not None and not self.currency:
            raise ValueError("currency is required when amount_fiat is provided")
        return self

    @field_validator("confirmation_message")
    @classmethod
    def valid_confirmation_message(cls, value):
        if value is None:
            return None
        value = value.replace("\r\n", "\n").replace("\r", "\n").strip()
        if any(char not in "\n\t" and (ord(char) < 32 or 127 <= ord(char) <= 159) for char in value):
            raise ValueError("Remove control characters from the confirmation message")
        return value or None

    @field_validator("button_text")
    @classmethod
    def valid_button_text(cls, value):
        value = " ".join(value.split())
        if not value or any(ord(char) < 32 or 127 <= ord(char) <= 159 for char in value):
            raise ValueError("Enter printable button text")
        return value

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value):
        if not value.strip():
            raise ValueError("Title is required")
        return value.strip()

    @model_validator(mode="after")
    def template_fields(self):
        if self.metadata is not None or self.expires_at is not None:
            raise ValueError("Template metadata and expiry overrides are not supported")
        return self

    @field_validator("currency")
    @classmethod
    def supported_currency(cls, value):
        if value is not None and value not in SUPPORTED_CURRENCIES:
            raise ValueError("Choose a supported currency")
        return value

    @field_validator("amount_xmr", "amount_fiat", "minimum_amount_xmr")
    @classmethod
    def amount_precision(cls, amount, info):
        if amount is None:
            return amount
        return check_amount_precision(amount, "XMR" if info.field_name != "amount_fiat" else "fiat")


def check_amount_precision(amount, currency):
    precision = 12 if currency == "XMR" else 2
    if not amount.is_finite() or amount >= Decimal("1000000") or amount != amount.quantize(Decimal(10) ** -precision):
        raise ValueError("Amount is too large or has too many decimal places")
    return amount



def merchant(db: Session = Depends(get_db), key: str = Depends(require_api_key)):
    user = _get_user_for_api_key(db, key)
    if user is None:
        raise HTTPException(401, "User API key required")
    return user


def serialize(link):
    site = os.getenv("SITE_URL", "http://localhost:3000").rstrip("/")
    return {
        "id": str(link.id), "title": link.title, "description": link.description,
        "amount_xmr": str(link.amount_xmr) if link.amount_xmr is not None else None,
        "amount_fiat": str(link.amount_fiat) if link.amount_fiat is not None else None,
        "currency": link.currency, "confirmation_target": link.confirmation_target,
        "checkout_continue_url": link.checkout_continue_url, "enabled": link.enabled,
        "confirmation_message": link.confirmation_message,
        "auto_create_invoice": link.auto_create_invoice,
        "button_text": link.button_text,
        "customer_amount": link.customer_amount,
        "minimum_amount_xmr": str(link.minimum_amount_xmr) if link.minimum_amount_xmr is not None else None,
        "url": f"{site}/pay/{link.token}",
        "action_url": f"{site}/api/core/public/payment-links/{link.token}/invoices",
    }


def apply_settings(link, payload, user):
    for name in ("title", "description", "amount_xmr", "amount_fiat", "enabled", "auto_create_invoice", "button_text", "confirmation_message", "customer_amount", "minimum_amount_xmr"):
        setattr(link, name, getattr(payload, name))
    link.currency = payload.currency if payload.amount_fiat is not None else None
    link.confirmation_target = payload.confirmation_target if payload.confirmation_target is not None else user.default_confirmation_target
    link.checkout_continue_url = str(payload.checkout_continue_url) if payload.checkout_continue_url else None


@router.get("/api/core/payment-links")
def list_links(response: Response, db: Session = Depends(get_db), user: User = Depends(merchant)):
    response.headers["Cache-Control"] = "no-store"
    return [serialize(row) for row in db.query(PaymentLink).filter(PaymentLink.user_id == user.id).order_by(PaymentLink.created_at.desc()).all()]


@router.post("/api/core/payment-links", status_code=201)
def create_link(payload: PaymentLinkInput, db: Session = Depends(get_db), user: User = Depends(merchant)):
    link = PaymentLink(user_id=user.id, token=secrets.token_urlsafe(32))
    apply_settings(link, payload, user)
    db.add(link)
    db.commit()
    db.refresh(link)
    return serialize(link)


@router.patch("/api/core/payment-links/{link_id}")
def edit_link(link_id: UUID, payload: PaymentLinkInput | PaymentLinkState, db: Session = Depends(get_db), user: User = Depends(merchant)):
    # Same lock order as public creation: merchant, then template.
    db.query(User).filter(User.id == user.id).with_for_update().one()
    link = db.query(PaymentLink).filter(PaymentLink.id == link_id, PaymentLink.user_id == user.id).with_for_update().first()
    if link is None:
        raise HTTPException(404, "Payment link not found")
    if isinstance(payload, PaymentLinkState):
        if payload.enabled:
            settings = {name: getattr(link, name) for name in (
                    "title", "description", "amount_xmr", "amount_fiat", "currency",
                    "confirmation_target", "checkout_continue_url", "confirmation_message",
                    "auto_create_invoice", "customer_amount", "minimum_amount_xmr")}
            try:
                PaymentLinkInput(**settings)
            except ValidationError:
                raise HTTPException(422, "Correct the saved payment-link settings before enabling it.") from None
        link.enabled = payload.enabled
    else:
        apply_settings(link, payload, user)
    db.commit()
    db.refresh(link)
    return serialize(link)


def enabled_link(db, token):
    link = db.query(PaymentLink).filter(PaymentLink.token == token, PaymentLink.enabled.is_(True)).first()
    if link is None:
        raise HTTPException(404, "This payment link is unavailable. Contact the merchant.")
    return link


@router.get("/api/core/public/payment-links/{token}")
def public_link(token: str, request: Request, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    data = serialize(enabled_link(db, token))
    data["action_url"] = f"{public_origin(request)}/api/core/public/payment-links/{token}/invoices"
    public = {key: data[key] for key in ("title", "description", "amount_xmr", "amount_fiat", "currency", "confirmation_target", "action_url", "auto_create_invoice", "customer_amount", "minimum_amount_xmr")}
    public["supported_currencies"] = SUPPORTED_CURRENCIES
    return public


def public_usage(db, user, now):
    return db.query(func.count(Invoice.id), func.min(Invoice.created_at)).filter(
        Invoice.user_id == user.id,
        Invoice.metadata_json["origin"].as_string() == "payment_link",
        Invoice.created_at > now - timedelta(days=1),
    ).one()


@router.get("/api/core/payment-links/status")
def link_status(response: Response, db: Session = Depends(get_db), user: User = Depends(merchant)):
    response.headers["Cache-Control"] = "no-store"
    now = datetime.now(timezone.utc)
    used, _ = public_usage(db, user, now)
    return {"supported_currencies": SUPPORTED_CURRENCIES,
            "daily_limit": PUBLIC_PAYMENT_LINK_DAILY_LIMIT, "used": used,
            "remaining": max(0, PUBLIC_PAYMENT_LINK_DAILY_LIMIT - used),
            "retrieved_at": now, "window_hours": 24}


def reserve_public_budget(db, user):
    # Caller holds the merchant lock until invoice commit, across all workers.
    now = datetime.now(timezone.utc)
    recent = public_usage(db, user, now)
    if recent[0] >= PUBLIC_PAYMENT_LINK_DAILY_LIMIT:
        oldest = recent[1]
        if oldest.tzinfo is None:
            oldest = oldest.replace(tzinfo=timezone.utc)
        retry = max(1, math.ceil((oldest + timedelta(days=1) - now).total_seconds()))
        raise HTTPException(429, "This merchant's public invoice allowance is temporarily unavailable.", headers={"Retry-After": str(retry)})


def error_page(status_code, detail, headers=None):
    return HTMLResponse(
        '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>Checkout unavailable</title><main style="max-width:40rem;margin:3rem auto;padding:1rem;font:1rem/1.6 sans-serif">'
        '<h1>Checkout unavailable</h1><p>' + html.escape(str(detail)) + '</p>'
        '<p>Invoice creation may have succeeded if the response was interrupted. Check any invoice URL you received or contact the merchant before submitting again.</p></main></html>',
        status_code=status_code, headers={**(headers or {}), "Cache-Control": "no-store"},
    )


MAX_CUSTOMER_AMOUNT_BODY = 256
AMOUNT_PATTERN = re.compile(r"\d{1,7}(\.\d{1,12})?")


@router.post("/api/core/public/payment-links/{token}/invoices")
async def purchase(token: str, request: Request):
    if request.url.query:
        return error_page(400, "This button does not accept price or checkout overrides.")
    body = b""
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_CUSTOMER_AMOUNT_BODY:
            return error_page(400, "The submitted amount is not valid.")
    return await run_in_threadpool(purchase_in_worker, token, request, body)


def purchase_in_worker(token: str, request: Request, body: bytes = b""):
    # Session lifetime and all blocking I/O stay inside this worker thread.
    with SessionLocal() as db:
        return create_purchase(token, request, db, body)


def parse_customer_amount(request: Request, body: bytes):
    """Accept exactly an amount and currency; nothing else can be overridden."""
    invalid = HTTPException(400, "Enter a valid amount and choose a supported currency.")
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    try:
        text = body.decode("utf-8")
        if content_type == "application/x-www-form-urlencoded":
            pairs = parse_qs(text, keep_blank_values=True, strict_parsing=True, max_num_fields=2)
            if any(len(values) != 1 for values in pairs.values()):
                raise invalid
            fields = {key: values[0] for key, values in pairs.items()}
        elif content_type == "application/json":
            fields = json.loads(text)
            if not isinstance(fields, dict) or not all(isinstance(value, str) for value in fields.values()):
                raise invalid
        else:
            raise invalid
    except (UnicodeDecodeError, ValueError):
        raise invalid from None
    if set(fields) != {"amount", "currency"}:
        raise invalid
    amount_text, currency = fields["amount"].strip(), fields["currency"].strip().upper()
    if currency != "XMR" and currency not in SUPPORTED_CURRENCIES:
        raise invalid
    if not AMOUNT_PATTERN.fullmatch(amount_text):
        raise invalid
    try:
        amount = check_amount_precision(Decimal(amount_text), currency)
    except (InvalidOperation, ValueError):
        raise HTTPException(400, "The amount is too large or has too many decimal places.") from None
    if amount <= 0:
        raise HTTPException(400, "Enter an amount greater than zero.")
    return amount, currency


def create_purchase(token: str, request: Request, db: Session, body: bytes = b""):
    wants_json = "application/json" in request.headers.get("accept", "")
    def failure(code, detail, headers=None):
        if wants_json:
            return JSONResponse({"detail": detail}, status_code=code, headers={**(headers or {}), "Cache-Control": "no-store"})
        return error_page(code, detail, headers)

    def success(invoice, replay=False):
        site = public_origin(request)
        url = f"{site}/invoice/{invoice.id}"
        if wants_json:
            return JSONResponse({"invoice_url": url, "status": invoice.status,
                "expires_at": invoice.expires_at.isoformat() if invoice.expires_at else None},
                status_code=200 if replay else 201, headers={"Cache-Control": "no-store"})
        return RedirectResponse(url, status_code=303, headers={"Cache-Control": "no-store"})

    try:
        raw_attempt = request.headers.get("idempotency-key")
        try:
            attempt = UUID(raw_attempt) if raw_attempt is not None else None
        except ValueError:
            raise HTTPException(400, "Idempotency-Key must be a UUID") from None
        initial = enabled_link(db, token)
        if not initial.customer_amount and body:
            raise HTTPException(400, "This button does not accept price or checkout overrides.")
        customer = parse_customer_amount(request, body) if initial.customer_amount else None
        user = db.query(User).filter(User.id == initial.user_id).with_for_update().first()
        if user is None or not user.payment_address or not user.view_key_encrypted:
            raise HTTPException(409, "The merchant checkout is unavailable.")
        link = db.query(PaymentLink).filter(PaymentLink.id == initial.id).populate_existing().with_for_update().one()
        if not link.enabled:
            raise HTTPException(404, "This payment link is unavailable. Contact the merchant.")
        if link.customer_amount != initial.customer_amount:
            raise HTTPException(409, "This payment link changed. Reload the page and try again.")
        if attempt:
            existing = db.query(Invoice).filter(Invoice.payment_link_id == link.id, Invoice.payment_link_attempt_id == attempt).first()
            if existing:
                logger.info("Public payment-link invoice replayed link=%s invoice=%s", link.id, existing.id)
                return success(existing, replay=True)
        reserve_public_budget(db, user)
        metadata = {"origin": "payment_link", "payment_link": {"id": str(link.id), "title": link.title, "description": link.description,
            "amount_source": "customer" if customer else "merchant"}}
        if link.confirmation_message:
            # Snapshot per invoice; shown publicly only after confirmation.
            metadata["checkout"] = {"confirmation_message": link.confirmation_message}
        if customer:
            amount, currency = customer
            amounts = {"amount_xmr": amount} if currency == "XMR" else {"amount_fiat": amount, "currency": currency}
        else:
            amounts = {"amount_xmr": link.amount_xmr, "amount_fiat": link.amount_fiat, "currency": link.currency}
        payload = InvoiceCreateUser(
            **amounts, confirmation_target=link.confirmation_target, checkout_continue_url=link.checkout_continue_url,
            metadata=metadata,
        )
        invoice = create_invoice_for_merchant(payload, request, db, user, payment_link_id=link.id, payment_link_attempt_id=attempt,
            minimum_amount_xmr=link.minimum_amount_xmr if customer else None)
        invoice = db.query(Invoice).filter(Invoice.id == invoice.id).one()
        logger.info("Public payment-link invoice created link=%s invoice=%s", link.id, invoice.id)
        return success(invoice)
    except HTTPException as exc:
        db.rollback()
        diagnostic = getattr(exc, "diagnostic_id", None)
        detail = str(exc.detail) + (f" Reference ID: {diagnostic}" if diagnostic else "")
        logger.info("Public payment-link creation unavailable status=%s", exc.status_code)
        return failure(exc.status_code, detail, exc.headers)
    except Exception:
        db.rollback()
        logger.warning("Public payment-link creation failed")
        return failure(503, "The checkout service is unavailable.")
