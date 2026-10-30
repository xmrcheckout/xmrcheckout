from __future__ import annotations

import hashlib
import math
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import SUBADDRESS_REUSE_COOLDOWN_SECONDS
from .models import Invoice, InvoiceTransfer, SubaddressAllocation, User
from .security import decrypt_secret
from .subaddress_derivation import derive_subaddress

MAX_SUBADDRESS_INDEX = 100


def allocation_lock_key(user_id: object) -> int:
    digest = hashlib.sha256(f"xmrcheckout:invoice:allocation:{user_id}".encode()).digest()
    return int.from_bytes(digest[:8], "big", signed=True)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def reuse_ready_at(invoices: list[Invoice]) -> datetime | None:
    closed = []
    for invoice in invoices:
        timestamp = (invoice.confirmed_at if invoice.status == "confirmed" else
                     invoice.expires_at if invoice.status == "expired" else None)
        if timestamp is None:
            return None
        closed.append(_utc(timestamp))
    return max(closed) + timedelta(seconds=SUBADDRESS_REUSE_COOLDOWN_SECONDS)


def create_subaddress_for_user(
    db: Session, *, user: User, invoice_id: UUID,
) -> tuple[str, int | None]:
    locked = db.query(User).filter(User.id == user.id).with_for_update().first()
    if locked is None:
        raise ValueError("User not found")
    # Coordinate with reconciliation, which commits while holding a session lock.
    if not db.execute(text("SELECT pg_try_advisory_xact_lock(:key)"),
                      {"key": allocation_lock_key(user.id)}).scalar():
        raise HTTPException(503, "Invoice detection is busy. Try again shortly.",
                            headers={"Retry-After": "5"})
    start = int(locked.subaddress_start_index or 0)
    if start < 0 or start >= MAX_SUBADDRESS_INDEX:
        start = 0
    view_key = decrypt_secret(locked.view_key_encrypted)
    history = db.query(Invoice).filter(Invoice.user_id == locked.id).all()
    allocations = db.query(SubaddressAllocation).filter(
        SubaddressAllocation.user_id == locked.id).all()
    now = datetime.now(timezone.utc)
    candidates = []
    future = []
    for index in range(start + 1, MAX_SUBADDRESS_INDEX + 1):
        address = derive_subaddress(payment_address=locked.payment_address,
                                    view_key=view_key, account_index=0, address_index=index)
        previous = [row for row in history if row.address == address]
        previous_allocations = [row for row in allocations if row.address == address]
        if not previous and not previous_allocations:
            candidates.append((False, now, index, address, previous))
        elif previous:
            ready = reuse_ready_at(previous)
            if ready is not None:
                if ready <= now:
                    candidates.append((True, ready, index, address, previous))
                else:
                    future.append(ready)
    if not candidates:
        retry = max(1, math.ceil((min(future) - now).total_seconds())) if future else 60
        raise HTTPException(429, "No invoice subaddress is available. Existing invoices must close and complete the reuse cooldown.",
                            headers={"Retry-After": str(retry)})
    reused, _, index, address, previous = min(candidates, key=lambda row: row[:3])
    excluded: set[str] = set()
    cutoff = None
    if reused:
        from .monero_service import MoneroWalletService
        try:
            cutoff, transfers = MoneroWalletService().snapshot_address(locked, address)
        except Exception as exc:
            raise HTTPException(503, "Cannot safely reuse an invoice subaddress while the view-only wallet snapshot is unavailable.") from exc
        excluded.update(transfer.txid for transfer in transfers)
        previous_ids = [row.id for row in previous]
        excluded.update(row.txid for row in db.query(InvoiceTransfer).filter(
            InvoiceTransfer.invoice_id.in_(previous_ids)).all())
        for allocation in allocations:
            if allocation.address == address:
                excluded.update(allocation.excluded_txids)
    generation = max(
        (row.generation for row in allocations if row.address == address), default=0,
    ) + 1
    db.add(SubaddressAllocation(
        invoice_id=invoice_id, user_id=locked.id, address=address,
        subaddress_index=index, cutoff_height=cutoff, generation=generation,
        excluded_txids=sorted(excluded), created_at=now,
    ))
    locked.next_subaddress_index = index + 1 if index < MAX_SUBADDRESS_INDEX else start + 1
    db.flush()
    return address, index
