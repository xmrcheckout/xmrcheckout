import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy.dialects.postgresql import dialect

from app import routes


@patch.dict(os.environ, {"SITE_URL": "https://checkout.example"})
class InvoiceRoutingTests(unittest.TestCase):
    def test_donation_invoice_url_uses_donation_route(self):
        invoice_id = uuid4()
        request = routes.Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": [(b"host", b"checkout.example")],
                "scheme": "https",
                "server": ("checkout.example", 443),
            }
        )
        invoice = SimpleNamespace(
            id=invoice_id,
            metadata_json={"origin": "donation"},
        )

        self.assertEqual(
            routes._invoice_url(invoice, request),
            f"https://checkout.example/donate/{invoice_id}",
        )

    def test_regular_invoice_url_stays_on_invoice_route(self):
        invoice_id = uuid4()
        request = routes.Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": [(b"host", b"checkout.example")],
                "scheme": "https",
                "server": ("checkout.example", 443),
            }
        )
        invoice = SimpleNamespace(id=invoice_id, metadata_json={})

        self.assertEqual(
            routes._invoice_url(invoice, request),
            f"https://checkout.example/invoice/{invoice_id}",
        )

    def test_invoice_and_qr_urls_ignore_forged_headers(self):
        request = routes.Request({
            "type": "http",
            "headers": [
                (b"host", b"attacker.example"),
                (b"x-forwarded-host", b"other-attacker.example"),
                (b"x-forwarded-proto", b"http"),
            ],
        })
        invoice_id = uuid4()
        invoice = SimpleNamespace(id=invoice_id, metadata_json={})
        self.assertEqual(routes._invoice_url(invoice, request),
                         f"https://checkout.example/invoice/{invoice_id}")
        self.assertEqual(routes._qr_url(invoice, request),
                         f"https://checkout.example/qr/{invoice_id}.png")

    def test_merchant_invoice_filter_excludes_donation_origin(self):
        compiled = str(
            routes._merchant_invoice_filter().compile(
                dialect=dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )

        self.assertIn("metadata", compiled)
        self.assertIn("origin", compiled)
        self.assertIn("donation", compiled)


if __name__ == "__main__":
    unittest.main()
