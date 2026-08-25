from __future__ import annotations

import argparse
from dataclasses import dataclass

from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Invoice, InvoiceTransfer
from .payment_timing import PaymentTiming, classify_payment_timing
from .reconciler import _xmr_to_atomic


@dataclass(frozen=True)
class TimingUpdate:
    invoice: Invoice
    timing: PaymentTiming


def _timing_updates(db: Session) -> tuple[list[TimingUpdate], int]:
    updates: list[TimingUpdate] = []
    unclassifiable = 0
    transfers_by_invoice: dict[object, list[InvoiceTransfer]] = {}
    for transfer in db.query(InvoiceTransfer).all():
        transfers_by_invoice.setdefault(transfer.invoice_id, []).append(transfer)
    invoices = (
        db.query(Invoice)
        .filter(Invoice.expires_at.is_not(None))
        .order_by(Invoice.created_at.asc())
        .all()
    )
    for invoice in invoices:
        transfers = transfers_by_invoice.get(invoice.id, [])
        required_atomic = _xmr_to_atomic(invoice.amount_xmr)
        if sum(max(0, transfer.amount_atomic) for transfer in transfers) < required_atomic:
            continue
        fallback_at = (
            invoice.detected_at
            or invoice.paid_after_expiry_at
            or invoice.confirmed_at
        )
        timing = classify_payment_timing(
            transfers=transfers,
            required_atomic=required_atomic,
            expires_at=invoice.expires_at,
            detection_fallback_at=fallback_at,
        )
        if timing is None:
            unclassifiable += 1
            continue
        if (
            invoice.paid_after_expiry != timing.paid_after_expiry
            or invoice.paid_after_expiry_at != timing.paid_after_expiry_at
        ):
            updates.append(TimingUpdate(invoice=invoice, timing=timing))
    return updates, unclassifiable


def run(*, apply: bool) -> int:
    db = SessionLocal()
    try:
        updates, unclassifiable = _timing_updates(db)
        for update in updates:
            invoice = update.invoice
            timing = update.timing
            late_at = (
                timing.paid_after_expiry_at.isoformat()
                if timing.paid_after_expiry_at
                else "-"
            )
            print(
                f"invoice={invoice.id} "
                f"old_late={bool(invoice.paid_after_expiry)} "
                f"new_late={timing.paid_after_expiry} "
                f"new_late_at={late_at} "
                f"source={'detection' if timing.used_detection_fallback else 'on-chain'}"
            )
            if apply:
                invoice.paid_after_expiry = timing.paid_after_expiry
                invoice.paid_after_expiry_at = timing.paid_after_expiry_at
                db.add(invoice)
        if apply:
            db.commit()
        else:
            db.rollback()
        print(
            f"mode={'apply' if apply else 'dry-run'} "
            f"updates={len(updates)} unclassifiable={unclassifiable}"
        )
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reclassify invoice payment timing from persisted transfers."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes. Without this flag the command is read-only.",
    )
    args = parser.parse_args()
    return run(apply=args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
