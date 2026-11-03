from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .config import (
    INVOICE_ACTIVE_LIMIT,
    INVOICE_CREATION_RATE_LIMIT,
    INVOICE_CREATION_RATE_WINDOW_SECONDS,
)
from .models import Invoice, User


def reserve_invoice_creation(
    db: Session,
    *,
    user: User,
    active_limit: int | None = None,
) -> User:
    """Atomically reserve one invoice creation for a user.

    The user row lock serializes quota checks across API workers and all
    invoice creation routes. The reservation is part of the caller's
    transaction and is rolled back if invoice creation fails.
    """
    locked = (
        db.query(User)
        .filter(User.id == user.id)
        .with_for_update()
        .first()
    )
    if locked is None:
        raise ValueError("User not found")

    now = datetime.now(timezone.utc)
    configured_active_limit = (
        INVOICE_ACTIVE_LIMIT if active_limit is None else active_limit
    )
    active_limit_value = max(1, configured_active_limit)
    active_count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.user_id == locked.id,
            Invoice.status.in_(["pending", "partially_paid", "payment_detected"]),
            or_(Invoice.expires_at.is_(None), Invoice.expires_at > now),
        )
        .scalar()
        or 0
    )
    if active_count >= active_limit_value:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Active invoice limit reached. Wait for an invoice to expire or request a higher limit.",
            headers={"Retry-After": "60"},
        )

    rate_limit = max(1, INVOICE_CREATION_RATE_LIMIT)
    window_seconds = max(1, INVOICE_CREATION_RATE_WINDOW_SECONDS)
    window_started_at = locked.invoice_creation_window_started_at
    if window_started_at is not None and window_started_at.tzinfo is None:
        window_started_at = window_started_at.replace(tzinfo=timezone.utc)
    window_expired = (
        window_started_at is None
        or now - window_started_at >= timedelta(seconds=window_seconds)
    )
    if window_expired:
        locked.invoice_creation_window_started_at = now
        locked.invoice_creation_count = 1
    else:
        count = int(locked.invoice_creation_count or 0)
        if count >= rate_limit:
            retry_after = max(
                1,
                math.ceil(
                    window_seconds - (now - window_started_at).total_seconds()
                ),
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Invoice creation rate limit reached. Try again shortly.",
                headers={"Retry-After": str(retry_after)},
            )
        locked.invoice_creation_count = count + 1

    db.add(locked)
    db.flush()
    return locked
