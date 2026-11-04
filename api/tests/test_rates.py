import unittest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import Mock, patch

from fastapi import HTTPException, Response

from app import rates
from app import routes


class RateCacheTests(unittest.TestCase):
    def setUp(self):
        rates._cached_quotes.clear()

    def tearDown(self):
        rates._cached_quotes.clear()

    @patch.object(rates, "COINGECKO_API_KEY", "test-key")
    @patch.object(rates.requests, "get")
    def test_one_request_fetches_and_caches_every_currency(self, mock_get):
        response = Mock()
        response.json.return_value = {"monero": {"usd": 125.5, "eur": 115.25}}
        mock_get.return_value = response

        usd = rates.get_xmr_rate("USD")
        eur = rates.get_xmr_rate("eur")
        cached_usd = rates.get_xmr_rate("usd")

        self.assertEqual(str(usd.rate), "125.5")
        self.assertEqual(eur.currency, "EUR")
        self.assertEqual(str(eur.rate), "115.25")
        self.assertIs(cached_usd, usd)
        self.assertEqual(mock_get.call_count, 1)
        requested = mock_get.call_args.kwargs["params"]["vs_currencies"].split(",")
        self.assertEqual(requested, [code.lower() for code in rates.SUPPORTED_CURRENCIES])

    @patch.object(rates, "COINGECKO_API_KEY", "test-key")
    @patch.object(rates.requests, "get")
    def test_unsupported_currency_is_rejected_without_a_request(self, mock_get):
        with self.assertRaisesRegex(
            rates.UnsupportedCurrencyError,
            "Unsupported fiat currency",
        ):
            rates.get_xmr_rate("ZZZ")
        mock_get.assert_not_called()

    @patch.object(rates, "COINGECKO_API_KEY", "test-key")
    @patch.object(rates.requests, "get")
    def test_missing_rate_in_reply_is_an_upstream_error(self, mock_get):
        response = Mock()
        response.json.return_value = {"monero": {"eur": 115.25}}
        mock_get.return_value = response

        with self.assertRaises(ValueError) as context:
            rates.get_xmr_rate("USD")
        self.assertNotIsInstance(context.exception, rates.UnsupportedCurrencyError)

    @patch.object(rates, "COINGECKO_API_KEY", "")
    def test_missing_api_key_is_reported(self):
        with self.assertRaisesRegex(RuntimeError, "API key is not configured"):
            rates.get_xmr_rate("USD")


class PublicRateRouteTests(unittest.TestCase):
    @patch.object(routes, "get_xmr_rate")
    def test_success_response_and_cache_header(self, mock_get_rate):
        mock_get_rate.return_value = rates.QuoteResult(
            rate=Decimal("123.45"),
            currency="USD",
            source="coingecko",
            quoted_at=datetime.now(timezone.utc),
        )
        response = Response()

        result = routes.get_public_xmr_rate("usd", response)

        self.assertEqual(result.currency, "USD")
        self.assertEqual(result.rate, Decimal("123.45"))
        self.assertEqual(response.headers["Cache-Control"], "public, max-age=60")

    def test_malformed_currency_returns_400(self):
        with self.assertRaises(HTTPException) as context:
            routes.get_public_xmr_rate("US", Response())

        self.assertEqual(context.exception.status_code, 400)

    @patch.object(
        routes,
        "get_xmr_rate",
        side_effect=rates.UnsupportedCurrencyError("unsupported"),
    )
    def test_unsupported_currency_returns_400(self, _mock_get_rate):
        with self.assertRaises(HTTPException) as context:
            routes.get_public_xmr_rate("ZZZ", Response())

        self.assertEqual(context.exception.status_code, 400)

    @patch.object(
        routes,
        "get_xmr_rate",
        side_effect=RuntimeError("unavailable"),
    )
    def test_unavailable_service_returns_503(self, _mock_get_rate):
        with self.assertRaises(HTTPException) as context:
            routes.get_public_xmr_rate("USD", Response())

        self.assertEqual(context.exception.status_code, 503)

    @patch.object(
        routes,
        "get_xmr_rate",
        side_effect=ValueError("invalid upstream response"),
    )
    def test_invalid_upstream_response_returns_503(self, _mock_get_rate):
        with self.assertRaises(HTTPException) as context:
            routes.get_public_xmr_rate("USD", Response())

        self.assertEqual(context.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
