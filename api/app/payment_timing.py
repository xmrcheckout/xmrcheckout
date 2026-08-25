from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol, Sequence


class TimestampedTransfer(Protocol):
    txid: str
    amount_atomic: int
    timestamp: int | None


@dataclass(frozen=True)
class PaymentTiming:
    paid_after_expiry: bool
    paid_after_expiry_at: datetime | None
    threshold_reached_at: datetime
    used_detection_fallback: bool = False


def classify_payment_timing(
    *,
    transfers: Sequence[TimestampedTransfer],
    required_atomic: int,
    expires_at: datetime | None,
    detection_fallback_at: datetime | None,
) -> PaymentTiming | None:
    positive = [transfer for transfer in transfers if transfer.amount_atomic > 0]
    received_atomic = sum(transfer.amount_atomic for transfer in positive)
    if required_atomic <= 0 or received_atomic < required_atomic:
        return None

    threshold_reached_at = _threshold_time(positive, required_atomic)
    used_detection_fallback = threshold_reached_at is None
    if threshold_reached_at is None:
        threshold_reached_at = _as_utc(detection_fallback_at)
    if threshold_reached_at is None:
        return None

    normalized_expiry = _as_utc(expires_at)
    paid_after_expiry = bool(
        normalized_expiry is not None and threshold_reached_at > normalized_expiry
    )
    return PaymentTiming(
        paid_after_expiry=paid_after_expiry,
        paid_after_expiry_at=threshold_reached_at if paid_after_expiry else None,
        threshold_reached_at=threshold_reached_at,
        used_detection_fallback=used_detection_fallback,
    )


def _threshold_time(
    transfers: Sequence[TimestampedTransfer],
    required_atomic: int,
) -> datetime | None:
    timestamped: list[tuple[int, str, int]] = []
    for transfer in transfers:
        timestamp = transfer.timestamp
        if not isinstance(timestamp, int) or timestamp <= 0:
            return None
        try:
            datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
        timestamped.append((timestamp, transfer.txid, transfer.amount_atomic))

    cumulative = 0
    for timestamp, _txid, amount_atomic in sorted(timestamped):
        cumulative += amount_atomic
        if cumulative >= required_atomic:
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
    return None


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
