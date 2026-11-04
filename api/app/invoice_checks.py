"""Which invoices the reconciler watches, and when a watched invoice is behind."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_

from .config import INVOICE_RECONCILE_INTERVAL_SECONDS, LATE_PAYMENT_LOOKBACK_HOURS
from .models import Invoice

AWAITING_PAYMENT_STATUSES = ("pending", "partially_paid", "payment_detected")
# Generous margin: one full cycle across all merchants can take a while.
CHECK_DELAYED_AFTER = timedelta(seconds=max(INVOICE_RECONCILE_INTERVAL_SECONDS * 10, 300))


def expired_invoice_needs_check(*, now: datetime):
    """Expired invoices still watched for late payments.

    An invoice stays in the set while it is inside its late-payment window, and
    afterwards until one check has succeeded after the window ended. A merchant
    whose checks keep failing, or a reconciler outage, therefore never causes a
    late payment to be missed, and other merchants' sets stop growing.
    """
    lookback = timedelta(hours=max(0, LATE_PAYMENT_LOOKBACK_HOURS))
    return and_(
        Invoice.status == "expired",
        Invoice.expires_at.is_not(None),
        or_(
            Invoice.expires_at >= now - lookback,
            Invoice.last_checked_at.is_(None),
            Invoice.last_checked_at < Invoice.expires_at + lookback,
        ),
    )


def watched_invoice_criteria(*, now: datetime):
    return or_(
        Invoice.status.in_(AWAITING_PAYMENT_STATUSES),
        expired_invoice_needs_check(now=now),
    )


def check_is_delayed(
    last_checked_at: datetime | None,
    created_at: datetime | None,
    *,
    now: datetime,
) -> bool:
    """True when an invoice has gone too long without a successful check."""
    reference = last_checked_at or created_at
    if reference is None:
        return True
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    return now - reference > CHECK_DELAYED_AFTER
