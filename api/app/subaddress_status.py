"""Read-only availability rules shared by allocation and merchant reporting."""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, load_only

from .config import SUBADDRESS_REUSE_COOLDOWN_SECONDS
from .models import Invoice, SnapshotStatus, SubaddressAllocation, User
from .security import decrypt_secret
from .subaddress_derivation import derive_subaddress

# A freshly restored wallet with default settings watches minor indices 0-199
# in account 0 (wallet2 SUBADDRESS_LOOKAHEAD_MINOR = 200), whatever its restore
# height. Staying within it means merchants never need to raise their lookahead.
MAX_SUBADDRESS_INDEX = 199
CATEGORIES = ("never_issued", "eligible_for_reuse", "reserved", "cooling_down", "needs_review")


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def closure_time(invoice: Invoice) -> datetime | None:
    # An invalid invoice stops showing its address no later than its expiry,
    # so its expiry is a conservative closure time.
    if invoice.status == "confirmed":
        return invoice.confirmed_at
    if invoice.status in ("expired", "invalid"):
        return invoice.expires_at
    return None


def reuse_ready_at(invoices: list[Invoice]) -> datetime | None:
    closed = []
    for invoice in invoices:
        timestamp = closure_time(invoice)
        if timestamp is None:
            return None
        closed.append(utc(timestamp))
    return max(closed) + timedelta(seconds=SUBADDRESS_REUSE_COOLDOWN_SECONDS) if closed else None


@dataclass
class AddressAvailability:
    index: int
    category: str
    code: str
    address: str = field(repr=False)
    previous: list[Invoice] = field(repr=False)
    latest_closure_at: datetime | None = None
    cooldown_complete_at: datetime | None = None

    def report(self):
        return {"index": self.index, "category": self.category, "code": self.code,
                "latest_closure_at": self.latest_closure_at,
                "cooldown_complete_at": self.cooldown_complete_at,
                "invoice_ids": [str(row.id) for row in self.previous]}


def availability(user: User, history: list[Invoice], allocations: list[SubaddressAllocation],
                 now: datetime) -> list[AddressAvailability]:
    start = int(user.subaddress_start_index or 0)
    if start < 0 or start >= MAX_SUBADDRESS_INDEX:
        start = 0
    view_key = decrypt_secret(user.view_key_encrypted)
    # Group once so each index is a lookup rather than a scan of the whole history.
    by_index: dict[int | None, list] = defaultdict(list)
    for item in history + allocations:
        by_index[item.subaddress_index].append(item)
    history_by_address: dict[str, list[Invoice]] = defaultdict(list)
    for item in history:
        history_by_address[item.address].append(item)
    allocations_by_address: dict[str, list[SubaddressAllocation]] = defaultdict(list)
    for item in allocations:
        allocations_by_address[item.address].append(item)
    result = []
    for index in range(start + 1, MAX_SUBADDRESS_INDEX + 1):
        address = derive_subaddress(payment_address=user.payment_address, view_key=view_key,
                                    account_index=0, address_index=index)
        previous = list(history_by_address.get(address, ()))
        issued = allocations_by_address.get(address, [])
        row = AddressAvailability(index, "never_issued", "never_issued", address, previous)
        # Items matching on address or index, each counted once.
        related = list({id(item): item for item in
                        previous + issued + by_index.get(index, [])}.values())
        prior_ids = {item.id for item in previous}
        generations = sorted(item.generation for item in issued)
        inconsistent = any(item.address != address or item.subaddress_index not in (None, index)
                           for item in related)
        inconsistent |= any(item.invoice_id not in prior_ids or item.subaddress_index != index
                            for item in issued)
        inconsistent |= bool(generations and generations != list(range(1, len(generations) + 1)))
        closed = [utc(closure_time(item)) for item in previous if closure_time(item) is not None]
        row.latest_closure_at = max(closed) if closed else None
        if inconsistent or (issued and not previous):
            row.category, row.code = "needs_review", "inconsistent_history"
        elif any(item.status not in ("pending", "partially_paid", "payment_detected", "confirmed", "expired", "invalid") for item in previous):
            row.category, row.code = "needs_review", "invalid_prior_invoice"
        elif any(item.status in ("confirmed", "expired", "invalid") and closure_time(item) is None
                 for item in previous):
            row.category, row.code = "needs_review", "missing_closure_time"
        elif any(item.status in ("pending", "partially_paid", "payment_detected") for item in previous):
            row.category = "reserved"
            row.code = ("awaiting_invoice_status_update" if any(
                item.status in ("pending", "partially_paid") and item.expires_at is not None and utc(item.expires_at) <= now
                for item in previous) else "active_invoice")
        elif previous:
            row.cooldown_complete_at = reuse_ready_at(previous)
            row.category = "eligible_for_reuse" if row.cooldown_complete_at <= now else "cooling_down"
            row.code = "cooldown_complete" if row.category == "eligible_for_reuse" else "reuse_cooldown"
        result.append(row)
    return result


def load_availability(db: Session, user: User, now: datetime):
    # Only the columns the availability rules read; skips large metadata on every creation.
    history = db.query(Invoice).options(load_only(
        Invoice.id, Invoice.address, Invoice.subaddress_index, Invoice.status,
        Invoice.confirmed_at, Invoice.expires_at,
    )).filter(Invoice.user_id == user.id).all()
    allocations = db.query(SubaddressAllocation).filter(SubaddressAllocation.user_id == user.id).all()
    return availability(user, history, allocations, now), allocations


def merchant_status(db: Session, user: User):
    now = datetime.now(timezone.utc)
    rows, _ = load_availability(db, user, now)
    snapshot = db.get(SnapshotStatus, user.id)
    future = [row.cooldown_complete_at for row in rows if row.category == "cooling_down"]
    return {
        "retrieved_at": now,
        "cooldown_seconds": SUBADDRESS_REUSE_COOLDOWN_SECONDS,
        "pool_size": len(rows),
        "counts": {category: sum(row.category == category for row in rows) for category in CATEGORIES},
        "earliest_estimated_eligibility_at": min(future) if future else None,
        "addresses": [row.report() for row in rows],
        "snapshot": None if snapshot is None else {
            name: getattr(snapshot, name) for name in (
                "attempt_id", "attempted_at", "completed_at", "outcome", "duration_ms",
                "failure_category", "last_success_at")},
    }
