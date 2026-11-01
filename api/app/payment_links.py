"""Merchant-owned reusable invoice templates. Public requests never use cookies."""
import html
import logging
import math
import os
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
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

    @field_validator("amount_xmr", "amount_fiat")
    @classmethod
    def amount_precision(cls, amount, info):
        if amount is None:
            return amount
        precision = 12 if info.field_name == "amount_xmr" else 2
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
        "auto_create_invoice": link.auto_create_invoice,
        "button_text": link.button_text,
        "url": f"{site}/pay/{link.token}",
        "action_url": f"{site}/api/core/public/payment-links/{link.token}/invoices",
    }


def apply_settings(link, payload, user):
    for name in ("title", "description", "amount_xmr", "amount_fiat", "enabled", "auto_create_invoice", "button_text"):
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
                    "confirmation_target", "checkout_continue_url")}
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
    return {key: data[key] for key in ("title", "description", "amount_xmr", "amount_fiat", "currency", "confirmation_target", "action_url", "auto_create_invoice")}


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


@router.post("/api/core/public/payment-links/{token}/invoices")
async def purchase(token: str, request: Request):
    if request.url.query or await request.stream().__anext__():
        return error_page(400, "This button does not accept price or checkout overrides.")
    return await run_in_threadpool(purchase_in_worker, token, request)


def purchase_in_worker(token: str, request: Request):
    # Session lifetime and all blocking I/O stay inside this worker thread.
    with SessionLocal() as db:
        return create_purchase(token, request, db)


def create_purchase(token: str, request: Request, db: Session):
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
        user = db.query(User).filter(User.id == initial.user_id).with_for_update().first()
        if user is None or not user.payment_address or not user.view_key_encrypted:
            raise HTTPException(409, "The merchant checkout is unavailable.")
        link = db.query(PaymentLink).filter(PaymentLink.id == initial.id).populate_existing().with_for_update().one()
        if not link.enabled:
            raise HTTPException(404, "This payment link is unavailable. Contact the merchant.")
        if attempt:
            existing = db.query(Invoice).filter(Invoice.payment_link_id == link.id, Invoice.payment_link_attempt_id == attempt).first()
            if existing:
                logger.info("Public payment-link invoice replayed link=%s invoice=%s", link.id, existing.id)
                return success(existing, replay=True)
        reserve_public_budget(db, user)
        payload = InvoiceCreateUser(
            amount_xmr=link.amount_xmr, amount_fiat=link.amount_fiat, currency=link.currency,
            confirmation_target=link.confirmation_target, checkout_continue_url=link.checkout_continue_url,
            metadata={"origin": "payment_link", "payment_link": {"id": str(link.id), "title": link.title, "description": link.description}},
        )
        invoice = create_invoice_for_merchant(payload, request, db, user, payment_link_id=link.id, payment_link_attempt_id=attempt)
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
