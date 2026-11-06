import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from starlette.requests import Request

from app.btcpay_routes import _invoice_checkout_link
from app.public_origin import public_origin


class PublicOriginTests(unittest.TestCase):
    def request(self, host, **headers):
        return Request({
            "type": "http",
            "headers": [(k.encode(), v.encode()) for k, v in {"host": host, **headers}.items()],
        })

    def test_origin_selection_ignores_request_headers(self):
        with patch.dict(os.environ, {"SITE_URL": "https://merchant.example/"}):
            request = self.request("attacker.example", **{
                "x-forwarded-host": "another-attacker.example",
                "x-forwarded-proto": "http",
            })
            self.assertEqual(public_origin(request), "https://merchant.example")

    def test_btcpay_checkout_link_ignores_request_headers(self):
        with patch.dict(os.environ, {"SITE_URL": "https://merchant.example"}):
            request = self.request("attacker.example", **{
                "x-forwarded-host": "another-attacker.example",
                "x-forwarded-proto": "http",
            })
            invoice = SimpleNamespace(id="inv-1")
            self.assertEqual(_invoice_checkout_link(invoice, request), "https://merchant.example/i/inv-1")

    def test_default_origin(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(public_origin(self.request("attacker.example")), "http://localhost:3000")
