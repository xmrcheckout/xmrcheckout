import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4


from app import routes


@patch.dict(os.environ, {"SITE_URL": "https://checkout.example"})
class InvoiceRoutingTests(unittest.TestCase):
    def test_older_donation_invoice_url_uses_invoice_route(self):
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
            f"https://checkout.example/invoice/{invoice_id}",
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



class PublicDisplayFieldsTests(unittest.TestCase):
    def test_customer_display_fields_are_trimmed_and_shown(self):
        self.assertEqual(
            routes._public_display_fields(
                {"recipient_name": "  Corner Bakery ", "description": "Order 1042", "order_id": "secret"}
            ),
            {"recipient_name": "Corner Bakery", "description": "Order 1042"},
        )

    def test_blank_or_non_text_fields_are_left_out(self):
        self.assertEqual(
            routes._public_display_fields({"recipient_name": "  ", "description": {"x": 1}}),
            {},
        )
        for metadata in (None, [], "text"):
            self.assertEqual(routes._public_display_fields(metadata), {})

    def test_btcpay_metadata_stays_private(self):
        self.assertEqual(
            routes._public_display_fields(
                {"btcpay": {"amount": "10"}, "recipient_name": "Shop", "description": "Customer note"}
            ),
            {},
        )


if __name__ == "__main__":
    unittest.main()
