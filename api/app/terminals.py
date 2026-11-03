"""In-person checkout terminals.

A terminal secret is a narrow credential for a shared device at a till. It can
create invoices for its merchant, read the status of invoices it created, and
cancel its own invoices before anything is received. It cannot read other
invoices, change settings, or access the merchant dashboard.
"""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from .db import get_db
from .models import Invoice, InvoiceTransfer, Terminal, User
from .payment_links import AMOUNT_PATTERN, SUPPORTED_CURRENCIES, check_amount_precision, merchant
from .routes import _public_invoice_status_response, create_invoice_for_merchant
from .schemas import InvoiceCreateUser
from .security import hash_api_key
from .subaddress_status import merchant_status

router = APIRouter()
logger = logging.getLogger(__name__)

TERMINAL_CURRENCIES = ("XMR",) + SUPPORTED_CURRENCIES
LOW_ADDRESS_WARNING = 20


def generate_terminal_secret() -> str:
    return f"xmrterm_{secrets.token_urlsafe(32)}"


class TerminalSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    default_currency: str = "XMR"
    confirmation_target: int = Field(default=0, ge=0, le=10)
    expiry_minutes: int = Field(default=15, ge=2, le=60)
    enabled: bool = True

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value):
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("default_currency")
    @classmethod
    def supported_currency(cls, value):
        value = value.strip().upper()
        if value not in TERMINAL_CURRENCIES:
            raise ValueError("Choose a supported currency")
        return value


class TerminalSale(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount: str = Field(max_length=24)
    currency: str = Field(max_length=3)
    note: str = Field(default="", max_length=200)

    @field_validator("note")
    @classmethod
    def printable_note(cls, value):
        value = " ".join(value.split())
        if any(ord(char) < 32 or 127 <= ord(char) <= 159 for char in value):
            raise ValueError("Remove control characters from the note")
        return value


def terminal_url(secret: str) -> str:
    site = os.getenv("SITE_URL", "http://localhost:3000").rstrip("/")
    # The secret stays in the fragment so it never reaches server logs or Referer headers.
    return f"{site}/terminal#k={secret}"


def serialize(terminal: Terminal, secret: str | None = None):
    data = {
        "id": str(terminal.id), "name": terminal.name,
        "default_currency": terminal.default_currency,
        "confirmation_target": terminal.confirmation_target,
        "expiry_minutes": terminal.expiry_minutes, "enabled": terminal.enabled,
        "created_at": terminal.created_at.isoformat() if terminal.created_at else None,
        "last_used_at": terminal.last_used_at.isoformat() if terminal.last_used_at else None,
    }
    if secret is not None:
        data["url"] = terminal_url(secret)
    return data


def owned_terminal(db: Session, user: User, terminal_id: UUID) -> Terminal:
    terminal = db.query(Terminal).filter(Terminal.id == terminal_id, Terminal.user_id == user.id).first()
    if terminal is None:
        raise HTTPException(404, "Terminal not found")
    return terminal


@router.get("/api/core/terminals")
def list_terminals(db: Session = Depends(get_db), user: User = Depends(merchant)):
    rows = db.query(Terminal).filter(Terminal.user_id == user.id).order_by(Terminal.created_at.desc()).all()
    return {"terminals": [serialize(row) for row in rows]}


@router.post("/api/core/terminals", status_code=201)
def create_terminal(payload: TerminalSettings, db: Session = Depends(get_db), user: User = Depends(merchant)):
    secret = generate_terminal_secret()
    terminal = Terminal(user_id=user.id, token_hash=hash_api_key(secret), **payload.model_dump())
    db.add(terminal)
    db.commit()
    db.refresh(terminal)
    logger.info("Terminal created terminal=%s", terminal.id)
    return serialize(terminal, secret)


@router.patch("/api/core/terminals/{terminal_id}")
def update_terminal(terminal_id: UUID, payload: TerminalSettings, db: Session = Depends(get_db), user: User = Depends(merchant)):
    terminal = owned_terminal(db, user, terminal_id)
    for name, value in payload.model_dump().items():
        setattr(terminal, name, value)
    db.commit()
    db.refresh(terminal)
    return serialize(terminal)


@router.post("/api/core/terminals/{terminal_id}/rotate")
def rotate_terminal(terminal_id: UUID, db: Session = Depends(get_db), user: User = Depends(merchant)):
    terminal = owned_terminal(db, user, terminal_id)
    secret = generate_terminal_secret()
    terminal.token_hash = hash_api_key(secret)
    db.commit()
    db.refresh(terminal)
    logger.info("Terminal secret rotated terminal=%s", terminal.id)
    return serialize(terminal, secret)


def current_terminal(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Terminal:
    scheme, _, secret = (authorization or "").partition(" ")
    secret = secret.strip()
    if scheme.lower() != "terminal" or not secret:
        raise HTTPException(401, "Terminal key required")
    terminal = db.query(Terminal).filter(Terminal.token_hash == hash_api_key(secret)).first()
    if terminal is None:
        raise HTTPException(401, "This terminal link is not valid. Ask the merchant for a new link.")
    if not terminal.enabled:
        raise HTTPException(403, "This terminal is disabled. The merchant can enable it in the dashboard.")
    return terminal


def free_addresses(db: Session, user: User) -> int:
    counts = merchant_status(db, user)["counts"]
    return counts.get("never_issued", 0) + counts.get("eligible_for_reuse", 0)


@router.get("/api/core/terminal/status")
def terminal_status(db: Session = Depends(get_db), terminal: Terminal = Depends(current_terminal)):
    user = db.query(User).filter(User.id == terminal.user_id).first()
    if user is None:
        raise HTTPException(409, "The merchant checkout is unavailable.")
    available = free_addresses(db, user)
    return {
        **serialize(terminal),
        "currencies": list(TERMINAL_CURRENCIES),
        "available_addresses": available,
        "low_addresses": available < LOW_ADDRESS_WARNING,
    }


def parse_sale_amount(sale: TerminalSale) -> tuple[Decimal, str]:
    currency = sale.currency.strip().upper()
    amount_text = sale.amount.strip()
    if currency not in TERMINAL_CURRENCIES or not AMOUNT_PATTERN.fullmatch(amount_text):
        raise HTTPException(400, "Enter a valid amount and choose a supported currency.")
    try:
        amount = check_amount_precision(Decimal(amount_text), currency)
    except (InvalidOperation, ValueError):
        raise HTTPException(400, "The amount is too large or has too many decimal places.") from None
    if amount <= 0:
        raise HTTPException(400, "Enter an amount greater than zero.")
    return amount, currency


@router.post("/api/core/terminal/invoices", status_code=201)
def create_sale(
    sale: TerminalSale,
    request: Request,
    idempotency_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
    terminal: Terminal = Depends(current_terminal),
):
    try:
        attempt = UUID(idempotency_key) if idempotency_key is not None else None
    except ValueError:
        raise HTTPException(400, "Idempotency-Key must be a UUID") from None
    amount, currency = parse_sale_amount(sale)
    user = db.query(User).filter(User.id == terminal.user_id).with_for_update().first()
    if user is None or not user.payment_address or not user.view_key_encrypted:
        raise HTTPException(409, "The merchant checkout is unavailable.")
    if attempt:
        existing = db.query(Invoice).filter(Invoice.terminal_id == terminal.id, Invoice.terminal_attempt_id == attempt).first()
        if existing:
            return JSONResponse(sale_response(db, existing, request), status_code=200)
    metadata = {"origin": "terminal", "terminal": {"id": str(terminal.id), "name": terminal.name, "note": sale.note}}
    amounts = {"amount_xmr": amount} if currency == "XMR" else {"amount_fiat": amount, "currency": currency}
    payload = InvoiceCreateUser(
        **amounts, confirmation_target=terminal.confirmation_target, metadata=metadata,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=terminal.expiry_minutes),
    )
    invoice = create_invoice_for_merchant(payload, request, db, user, terminal_id=terminal.id, terminal_attempt_id=attempt)
    invoice = db.query(Invoice).filter(Invoice.id == invoice.id).one()
    touch(db, terminal)
    logger.info("Terminal invoice created terminal=%s invoice=%s", terminal.id, invoice.id)
    return sale_response(db, invoice, request)


def touch(db: Session, terminal: Terminal):
    db.query(Terminal).filter(Terminal.id == terminal.id).update(
        {Terminal.last_used_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()


def terminal_invoice(db: Session, terminal: Terminal, invoice_id: UUID, *, lock=False) -> Invoice:
    query = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.terminal_id == terminal.id)
    invoice = (query.with_for_update() if lock else query).first()
    if invoice is None:
        raise HTTPException(404, "Invoice not found")
    return invoice


def sale_response(db: Session, invoice: Invoice, request: Request):
    data = _public_invoice_status_response(db, invoice, request).model_dump(mode="json")
    note = ((invoice.metadata_json or {}).get("terminal") or {}).get("note")
    data["note"] = note or None
    data["invoice_url"] = f"{os.getenv('SITE_URL', 'http://localhost:3000').rstrip('/')}/invoice/{invoice.id}"
    return data


@router.get("/api/core/terminal/invoices/{invoice_id}")
def get_sale(invoice_id: UUID, request: Request, db: Session = Depends(get_db), terminal: Terminal = Depends(current_terminal)):
    return sale_response(db, terminal_invoice(db, terminal, invoice_id), request)


@router.post("/api/core/terminal/invoices/{invoice_id}/cancel")
def cancel_sale(invoice_id: UUID, request: Request, db: Session = Depends(get_db), terminal: Terminal = Depends(current_terminal)):
    invoice = terminal_invoice(db, terminal, invoice_id, lock=True)
    received = (invoice.total_paid_atomic or 0) > 0 or invoice.detected_at is not None or db.query(
        InvoiceTransfer).filter(InvoiceTransfer.invoice_id == invoice.id).first() is not None
    if invoice.status != "pending" or received:
        db.rollback()
        raise HTTPException(409, "This invoice can no longer be cancelled because a payment was seen or it already closed.")
    now = datetime.now(timezone.utc)
    if invoice.expires_at is None or invoice.expires_at > now:
        # Expiry is the only change; reconciliation closes it and still detects late payments.
        invoice.expires_at = now
    db.commit()
    db.refresh(invoice)
    logger.info("Terminal invoice cancelled terminal=%s invoice=%s", terminal.id, invoice.id)
    return sale_response(db, invoice, request)
