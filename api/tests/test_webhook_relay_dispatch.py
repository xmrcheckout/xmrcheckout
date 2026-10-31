"""Exercise real dispatch/redelivery through the shared relay transport with fixtures."""
import base64
import hashlib
import hmac
import json
import os
import socket
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app import btcpay_webhooks, routes, webhooks


class RelayDispatchTests(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.invoice_id = uuid4()
        self.payload = {"event": "invoice.created", "metadata": {"unicode": "€"}}
        self.body = json.dumps(self.payload, separators=(",", ":"), ensure_ascii=False).encode()
        for patcher in (
            patch.dict(os.environ, {
                "WEBHOOK_RELAY_ENABLED": "true",
                "WEBHOOK_RELAY_URL": "https://relay.example/deliver",
                "WEBHOOK_RELAY_TOKEN": "s" * 64,
            }),
            patch("app.webhook_http.socket.getaddrinfo", return_value=[
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
            ]),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = patch("app.webhook_http.requests.Session")
        self.session = patcher.start().return_value.__enter__.return_value
        self.addCleanup(patcher.stop)
        response = MagicMock(status_code=200)
        response.__enter__.return_value = response
        response.iter_content.return_value = [b'{"version":1,"http_status":204,"location":null}']
        self.session.post.return_value = response
        patcher = patch("app.webhook_http.requests.post")
        self.direct = patcher.start()
        self.addCleanup(patcher.stop)

    def forwarded(self):
        self.direct.assert_not_called()
        data = self.session.post.call_args.kwargs["json"]
        self.assertEqual(base64.b64decode(data["body_base64"]), self.body)
        return data

    def test_native_dispatch_records_recipient_result(self):
        hook = SimpleNamespace(id=uuid4(), events=["invoice.created"], event_urls={},
                               url="https://merchant.example/events")
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [hook]
        invoice = SimpleNamespace(id=self.invoice_id, address="fixture-address", subaddress_index=1,
                                  amount_xmr=1, status="pending")
        with patch.object(webhooks, "build_webhook_payload", return_value=self.payload), \
                patch.object(webhooks, "_ensure_webhook_secret", return_value="merchant-secret"):
            webhooks.dispatch_webhooks(db, str(self.user_id), "invoice.created", invoice)
        self.assertEqual(self.forwarded()["headers"]["X-Webhook-Secret"], "merchant-secret")
        self.assertEqual(db.add_all.call_args.args[0][0].http_status, 204)

    def test_btcpay_signature_matches_original_bytes(self):
        hook = SimpleNamespace(id=uuid4(), authorized_events={"everything": True},
                               secret_encrypted="fixture", url="https://merchant.example/events")
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [hook]
        with patch.object(btcpay_webhooks, "_build_payload", return_value=self.payload), \
                patch.object(btcpay_webhooks, "decrypt_secret", return_value="merchant-secret"):
            btcpay_webhooks.dispatch_btcpay_webhooks(db, str(self.user_id), "InvoiceCreated",
                                                   SimpleNamespace(id=self.invoice_id))
        signature = self.forwarded()["headers"]["BTCPay-Sig"]
        expected = hmac.new(b"merchant-secret", self.body, hashlib.sha256).hexdigest()
        self.assertEqual(signature, "sha256=" + expected)

    def test_manual_redelivery_uses_relay_and_records_recipient_result(self):
        delivery = SimpleNamespace(
            http_status=500, payload_json=self.payload, invoice_id=self.invoice_id,
            url="https://merchant.example/events", webhook_id=uuid4(), event="invoice.created",
            invoice_address="fixture-address", invoice_subaddress_index=1,
            invoice_amount_xmr=1, invoice_status="pending",
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = delivery
        with patch.object(routes, "_get_user_for_api_key", return_value=SimpleNamespace(id=self.user_id)), \
                patch.object(routes, "_ensure_webhook_secret", return_value="merchant-secret"):
            result = routes.redeliver_webhook_delivery(uuid4(), db=db, api_key="fixture-key")
        self.forwarded()
        self.assertEqual(result["http_status"], 204)
        self.assertIsNone(result["error_message"])
