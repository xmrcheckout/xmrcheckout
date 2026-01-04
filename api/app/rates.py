from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import threading
import time
from typing import Any

import requests

from .config import COINGECKO_API_KEY

COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"
COINGECKO_SOURCE = "coingecko"
RATE_TTL_SECONDS = 60


@dataclass(frozen=True)
class QuoteResult:
    rate: Decimal
    currency: str
    source: str
    quoted_at: datetime


_cache_lock = threading.Lock()
_cached_quote: QuoteResult | None = None
_cached_at: float | None = None


def get_xmr_rate(currency: str) -> QuoteResult:
    global _cached_quote, _cached_at
    normalized_currency = currency.strip().lower()
    if not COINGECKO_API_KEY:
        raise RuntimeError("CoinGecko API key is not configured")

    with _cache_lock:
        if _cached_quote and _cached_at:
            if time.monotonic() - _cached_at < RATE_TTL_SECONDS:
                return _cached_quote

    params = {
        "vs_currencies": normalized_currency,
        "ids": "monero",
        "x_cg_demo_api_key": COINGECKO_API_KEY,
    }
    response = requests.get(COINGECKO_URL, params=params, timeout=5)
    response.raise_for_status()
    data: dict[str, Any] = response.json()
    rate_value = (
        data.get("monero", {}).get(normalized_currency)
        if isinstance(data, dict)
        else None
    )
    if rate_value is None:
        raise ValueError("Unsupported fiat currency at this time")
    rate = Decimal(str(rate_value))
    quote = QuoteResult(
        rate=rate,
        currency=normalized_currency.upper(),
        source=COINGECKO_SOURCE,
        quoted_at=datetime.now(timezone.utc),
    )
    with _cache_lock:
        _cached_quote = quote
        _cached_at = time.monotonic()
    return quote
