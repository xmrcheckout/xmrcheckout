import unittest
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from app import routes
from app.btcpay_schemas import BtcpayInvoiceCreate

UNSAFE_URLS = (
    "javascript:alert(document.cookie)",
    " JavaScript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "https://shop.example\\@other.example/",
    "https://shop.example/​thanks",
    "https:shop.example",
    "//shop.example/thanks",
)


def _invoice(**overrides):
    now = datetime.now(timezone.utc)
    values = dict(
        id=uuid4(),
        address="8" + "A" * 94,
        subaddress_index=1,
        amount_xmr=Decimal("0.1"),
        status="confirmed",
        confirmation_target=0,
        confirmations=0,
        created_at=now,
        expires_at=now,
        detected_at=now,
        confirmed_at=now,
        metadata_json={},
        total_paid_atomic=None,
        payment_link_id=None,
        user_id=None,
    )
    values.update(overrides)
    return SimpleNamespace(**values)


def _status_response(invoice):
    with patch.object(routes, "_qr_url", return_value=None), patch.object(
        routes, "_invoice_checking_delayed", return_value=False
    ):
        return routes._public_invoice_status_response(MagicMock(), invoice, MagicMock())


class WebUrlTests(unittest.TestCase):
    def test_web_links_are_kept(self):
        self.assertEqual(routes._web_url(" https://shop.example/thanks?o=1 "), "https://shop.example/thanks?o=1")
        self.assertEqual(routes._web_url("http://shop.example/thanks"), "http://shop.example/thanks")
        self.assertEqual(routes._web_url("HTTPS://shop.example/"), "HTTPS://shop.example/")

    def test_continue_rule_allows_http_only_for_localhost(self):
        self.assertIsNone(routes._web_url("http://shop.example/thanks", https_only=True))
        self.assertEqual(routes._web_url("http://localhost:3000/done", https_only=True), "http://localhost:3000/done")
        self.assertEqual(routes._web_url("http://127.0.0.1/done", https_only=True), "http://127.0.0.1/done")
        self.assertEqual(routes._web_url("https://shop.example/", https_only=True), "https://shop.example/")

    def test_other_schemes_and_malformed_links_are_dropped(self):
        for value in UNSAFE_URLS + ("", "   ", None, 42, {"url": "https://shop.example"}, "http://[::1"):
            with self.subTest(value=value):
                self.assertIsNone(routes._web_url(value))


class BtcpayRedirectUrlTests(unittest.TestCase):
    def test_redirect_url_must_be_a_web_link(self):
        for value in ("javascript:alert(1)", "data:text/html,x", "vbscript:msgbox(1)", "ftp://files.example/a"):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                BtcpayInvoiceCreate(amount="1", currency="USD", checkout={"redirectURL": value})

    def test_web_redirect_url_is_accepted(self):
        for value in ("https://shop.example/order/1", "http://shop.example/order/1"):
            with self.subTest(value=value):
                payload = BtcpayInvoiceCreate(amount="1", currency="USD", checkout={"redirectURL": value})
                self.assertEqual(str(payload.checkout.redirectURL), value)


class PublicInvoiceLinkTests(unittest.TestCase):
    def test_status_response_drops_unsafe_btcpay_redirect(self):
        for value in UNSAFE_URLS:
            with self.subTest(value=value):
                metadata = {"btcpay": {"checkout": {"redirectURL": value, "redirectAutomatically": True}}}
                response = _status_response(_invoice(metadata_json=metadata))
                self.assertIsNone(response.btcpay_redirect_url)

    def test_status_response_keeps_web_btcpay_redirect(self):
        metadata = {"btcpay": {"checkout": {"redirectURL": "https://shop.example/order/1"}}}
        response = _status_response(_invoice(metadata_json=metadata))
        self.assertEqual(response.btcpay_redirect_url, "https://shop.example/order/1")

    def test_continue_link_needs_https(self):
        for value in UNSAFE_URLS + ("http://shop.example/thanks",):
            with self.subTest(value=value):
                invoice = _invoice(metadata_json={"checkout": {"continue_url": value}})
                self.assertFalse(_status_response(invoice).checkout_continue_available)
                db = MagicMock()
                db.query.return_value.filter.return_value.first.return_value = invoice
                with self.assertRaises(HTTPException) as raised:
                    routes.continue_invoice_after_confirmation(invoice.id, db)
                self.assertEqual(raised.exception.status_code, 404)

    def test_continue_link_redirects_to_https(self):
        invoice = _invoice(metadata_json={"checkout": {"continue_url": "https://shop.example/thanks"}})
        self.assertTrue(_status_response(invoice).checkout_continue_available)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = invoice
        response = routes.continue_invoice_after_confirmation(invoice.id, db)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["location"], "https://shop.example/thanks")


if __name__ == "__main__":
    unittest.main()
