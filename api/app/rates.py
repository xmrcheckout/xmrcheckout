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
SUPPORTED_CURRENCIES = ("USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "HKD", "SGD", "INR", "BRL", "MXN", "SEK", "NOK", "DKK", "ZAR", "PLN", "KRW")


@dataclass(frozen=True)
class QuoteResult:
    rate: Decimal
    currency: str
    source: str
    quoted_at: datetime


class UnsupportedCurrencyError(ValueError):
    pass


_cache_lock = threading.Lock()
_cached_quotes: dict[str, tuple[QuoteResult, float]] = {}


def get_xmr_rate(currency: str) -> QuoteResult:
    normalized_currency = currency.strip().upper()
    if normalized_currency not in SUPPORTED_CURRENCIES:
        raise UnsupportedCurrencyError("Unsupported fiat currency at this time")
    if not COINGECKO_API_KEY:
        raise RuntimeError("CoinGecko API key is not configured")

    with _cache_lock:
        cached = _cached_quotes.get(normalized_currency)
        if cached:
            cached_quote, cached_at = cached
            if time.monotonic() - cached_at < RATE_TTL_SECONDS:
                return cached_quote

        params = {
            "vs_currencies": ",".join(code.lower() for code in SUPPORTED_CURRENCIES),
            "ids": "monero",
            "x_cg_demo_api_key": COINGECKO_API_KEY,
        }
        response = requests.get(COINGECKO_URL, params=params, timeout=5)
        response.raise_for_status()
        data: Any = response.json()
        rates = data.get("monero") if isinstance(data, dict) else None
        if not isinstance(rates, dict):
            raise ValueError("Unexpected CoinGecko response")
        quoted_at = datetime.now(timezone.utc)
        fetched_at = time.monotonic()
        for code in SUPPORTED_CURRENCIES:
            rate_value = rates.get(code.lower())
            if rate_value is None:
                continue
            _cached_quotes[code] = (
                QuoteResult(
                    rate=Decimal(str(rate_value)),
                    currency=code,
                    source=COINGECKO_SOURCE,
                    quoted_at=quoted_at,
                ),
                fetched_at,
            )
        cached = _cached_quotes.get(normalized_currency)
        if cached is None or cached[1] != fetched_at:
            raise ValueError("CoinGecko response is missing the requested currency")
        return cached[0]
