import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from app import btcpay_routes, routes
from app.btcpay_schemas import BtcpayInvoiceCreate
from app.schemas import InvoiceCreateUser


def _quote(rate):
    return SimpleNamespace(
        rate=Decimal(rate),
        currency="USD",
        source="test",
        quoted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


class InvoiceAmountValidationTests(unittest.TestCase):
    def test_native_rejects_xmr_amount_below_one_piconero(self):
        with self.assertRaises(ValidationError):
            InvoiceCreateUser(amount_xmr=Decimal("0.0000000000001"))

    def test_native_rejects_fiat_amount_with_sub_cent_precision(self):
        with self.assertRaises(ValidationError):
            InvoiceCreateUser(amount_fiat=Decimal("0.001"), currency="USD")

    def test_native_accepts_one_piconero(self):
        payload = InvoiceCreateUser(amount_xmr=Decimal("0.000000000001"))
        self.assertEqual(payload.amount_xmr, Decimal("0.000000000001"))

    def test_btcpay_rejects_xmr_amount_below_one_piconero(self):
        with self.assertRaises(ValidationError):
            BtcpayInvoiceCreate(amount=Decimal("0.0000000000001"), currency="xmr")

    def test_btcpay_rejects_fiat_amount_with_sub_cent_precision(self):
        with self.assertRaises(ValidationError):
            BtcpayInvoiceCreate(amount=Decimal("0.001"), currency="USD")

    def test_btcpay_accepts_one_piconero_and_one_cent(self):
        BtcpayInvoiceCreate(amount=Decimal("0.000000000001"), currency="XMR")
        BtcpayInvoiceCreate(amount=Decimal("0.01"), currency="USD")


class ConvertedAmountTests(unittest.TestCase):
    def test_native_rejects_fiat_that_converts_to_zero_xmr(self):
        with patch.object(routes, "get_xmr_rate", return_value=_quote("1e12")):
            with self.assertRaises(HTTPException) as ctx:
                routes._resolve_invoice_amount(
                    None, user=None, requested_amount_fiat=Decimal("0.01"), requested_currency="USD"
                )
        self.assertEqual(ctx.exception.status_code, 422)

    def test_btcpay_rejects_fiat_that_converts_to_zero_xmr(self):
        with patch.object(btcpay_routes, "get_xmr_rate", return_value=_quote("1e12")):
            with self.assertRaises(HTTPException) as ctx:
                btcpay_routes._resolve_btcpay_amount(Decimal("0.01"), "USD")
        self.assertEqual(ctx.exception.status_code, 422)

    def test_native_fiat_conversion_still_works(self):
        with patch.object(routes, "get_xmr_rate", return_value=_quote("200")):
            amount, _, _ = routes._resolve_invoice_amount(
                None, user=None, requested_amount_fiat=Decimal("10"), requested_currency="USD"
            )
        self.assertEqual(amount, Decimal("0.05"))


if __name__ == "__main__":
    unittest.main()


class InvoiceExpiryTests(unittest.TestCase):
    def test_past_expiry_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            routes._resolve_invoice_expiry(datetime.now(timezone.utc) - timedelta(minutes=1))
        self.assertEqual(ctx.exception.status_code, 422)

    def test_naive_expiry_is_read_as_utc(self):
        naive = datetime.utcnow().replace(microsecond=0) + timedelta(hours=2)
        self.assertEqual(routes._resolve_invoice_expiry(naive), naive.replace(tzinfo=timezone.utc))

    def test_aware_expiry_is_kept(self):
        aware = datetime.now(timezone(timedelta(hours=-8))) + timedelta(hours=2)
        self.assertEqual(routes._resolve_invoice_expiry(aware), aware)

    def test_past_expiry_rejected_before_any_address_is_reserved(self):
        payload = InvoiceCreateUser(amount_xmr=Decimal("1"), expires_at=datetime(2020, 1, 1, tzinfo=timezone.utc))
        user = SimpleNamespace(default_confirmation_target=1)
        with patch.object(routes, "reserve_invoice_creation", side_effect=AssertionError("reserved")), \
                patch.object(routes, "create_subaddress_for_user", side_effect=AssertionError("allocated")):
            with self.assertRaises(HTTPException) as ctx:
                routes.create_invoice_for_merchant(payload, None, None, user)
        self.assertEqual(ctx.exception.status_code, 422)
