"""Fixed schedule for automatically retrying failed webhook deliveries."""
from __future__ import annotations

from datetime import datetime, timedelta

# Delay before each automatic retry after a failed attempt. Attempt 1 is the
# original delivery, so a delivery is tried at most len(RETRY_DELAYS) + 1 times
# over roughly 33 hours.
RETRY_DELAYS = (
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=30),
    timedelta(hours=2),
    timedelta(hours=6),
    timedelta(hours=24),
)
MAX_ATTEMPTS = len(RETRY_DELAYS) + 1


def delivery_failed(http_status: int | None) -> bool:
    return http_status is None or http_status >= 400


def next_attempt_time(
    attempt: int,
    http_status: int | None,
    now: datetime,
) -> datetime | None:
    """Return when to retry a delivery attempt, or None when no retry is due."""
    if not delivery_failed(http_status) or attempt < 1 or attempt >= MAX_ATTEMPTS:
        return None
    return now + RETRY_DELAYS[attempt - 1]
