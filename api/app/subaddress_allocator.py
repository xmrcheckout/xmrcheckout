from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from time import monotonic
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from .models import InvoiceTransfer, SubaddressAllocation, User
from .allocation_diagnostics import AllocationError, failure_category, log_event, persist_snapshot
from .subaddress_status import MAX_SUBADDRESS_INDEX, load_availability, reuse_ready_at


def allocation_lock_key(user_id: object) -> int:
    digest = hashlib.sha256(f"xmrcheckout:invoice:allocation:{user_id}".encode()).digest()
    return int.from_bytes(digest[:8], "big", signed=True)


def create_subaddress_for_user(
    db: Session, *, user: User, invoice_id: UUID,
) -> tuple[str, int | None]:
    reference = uuid4()
    started = monotonic()

    def reject(status, detail, code, retry=None, index=None):
        log_event("allocation_rejected", user_id=user.id, attempt_id=reference,
                  reason_code=code, duration_ms=int((monotonic() - started) * 1000), index=index)
        raise AllocationError(status, detail, code, reference, retry)

    locked = db.query(User).filter(User.id == user.id).with_for_update().first()
    if locked is None:
        raise ValueError("User not found")
    # Coordinate with reconciliation, which commits while holding a session lock.
    if not db.execute(text("SELECT pg_try_advisory_xact_lock(:key)"),
                      {"key": allocation_lock_key(user.id)}).scalar():
        reject(503, "Invoice detection is busy. Try again shortly.", "allocation_contention", 5)
    now = datetime.now(timezone.utc)
    rows, allocations = load_availability(db, locked, now)
    candidates = [row for row in rows if row.category in ("never_issued", "eligible_for_reuse")]
    future = [row.cooldown_complete_at for row in rows if row.category == "cooling_down"]
    if not candidates:
        retry = max(1, math.ceil((min(future) - now).total_seconds())) if future else 60
        reject(429, "No invoice subaddress is available. Existing invoices must close and complete the reuse cooldown.",
               "pool_exhausted", retry)
    selected = min(candidates, key=lambda row: (
        row.category != "never_issued", row.cooldown_complete_at or now, row.index))
    reused = selected.category == "eligible_for_reuse"
    index, address, previous = selected.index, selected.address, selected.previous
    excluded: set[str] = set()
    cutoff = None
    if reused:
        from .monero_service import MoneroWalletService
        attempted_at = datetime.now(timezone.utc)
        snapshot_started = monotonic()
        persist_snapshot(db, user_id=locked.id, attempt_id=reference, attempted_at=attempted_at)
        try:
            cutoff, transfers = MoneroWalletService().snapshot_address(locked, address)
        except Exception as exc:
            duration = int((monotonic() - snapshot_started) * 1000)
            category, rpc_code = failure_category(exc)
            persist_snapshot(db, user_id=locked.id, attempt_id=reference, attempted_at=attempted_at,
                             outcome="failed", duration_ms=duration, failure=category)
            log_event("snapshot_failed", user_id=locked.id, attempt_id=reference, reason_code=category,
                      duration_ms=duration, index=index, rpc_error_code=rpc_code)
            reject(503, "Cannot safely reuse an invoice subaddress while the view-only wallet snapshot is unavailable.",
                   "snapshot_failed", index=index)
        duration = int((monotonic() - snapshot_started) * 1000)
        persist_snapshot(db, user_id=locked.id, attempt_id=reference, attempted_at=attempted_at,
                         outcome="succeeded", duration_ms=duration)
        excluded.update(transfer.txid for transfer in transfers)
        previous_ids = [row.id for row in previous]
        excluded.update(row.txid for row in db.query(InvoiceTransfer).filter(
            InvoiceTransfer.invoice_id.in_(previous_ids)).all())
        for allocation in allocations:
            if allocation.address == address:
                excluded.update(allocation.excluded_txids)
        log_event("snapshot_succeeded", user_id=locked.id, attempt_id=reference,
                  reason_code="snapshot_succeeded", duration_ms=duration, index=index,
                  cutoff_height=cutoff, exclusion_count=len(excluded))
    generation = max(
        (row.generation for row in allocations if row.address == address), default=0,
    ) + 1
    db.add(SubaddressAllocation(
        invoice_id=invoice_id, user_id=locked.id, address=address,
        subaddress_index=index, cutoff_height=cutoff, generation=generation,
        excluded_txids=sorted(excluded), created_at=now,
    ))
    locked.next_subaddress_index = index + 1 if index < MAX_SUBADDRESS_INDEX else rows[0].index
    db.flush()
    return address, index
