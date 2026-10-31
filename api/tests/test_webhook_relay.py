import base64
import json
import os
import socket
import unittest
from unittest.mock import MagicMock, patch

from requests import RequestException

from app.webhook_http import UnsafeWebhookUrl, post_webhook_with_redirects


class WebhookRelayTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "WEBHOOK_RELAY_ENABLED": "true",
            "WEBHOOK_RELAY_URL": "https://relay.example/deliver",
            "WEBHOOK_RELAY_TOKEN": "s" * 64,
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        dns = patch("app.webhook_http.socket.getaddrinfo", return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
        ])
        dns.start()
        self.addCleanup(dns.stop)
        direct = patch("app.webhook_http.requests.post")
        self.direct = direct.start()
        self.addCleanup(direct.stop)
        session = patch("app.webhook_http.requests.Session")
        self.session = session.start().return_value.__enter__.return_value
        self.addCleanup(session.stop)
        self.reply(204)

    def reply(self, code=204, *, status=200, location=None, raw=None):
        response = MagicMock(status_code=status)
        response.iter_content.return_value = [raw if raw is not None else json.dumps({
            "version": 1, "http_status": code, "location": location,
        }).encode()]
        response.__enter__.return_value = response
        self.session.post.return_value = response

    def deliver(self, *, data=b'{"unicode":"\xe2\x82\xac"}'):
        return post_webhook_with_redirects(
            "https://merchant.example/events", data=data,
            headers={"Content-Type": "application/json", "BTCPay-Sig": "sha256=fixture",
                     "X-Webhook-Secret": "merchant-secret", "X-Real-IP": "sensitive"},
            timeout=10,
        )

    def test_only_relay_is_contacted_and_bytes_and_auth_preserved(self):
        response = self.deliver()
        self.assertEqual(response.status_code, 204)
        self.direct.assert_not_called()
        args, kwargs = self.session.post.call_args
        self.assertEqual(args, ("https://relay.example/deliver",))
        self.assertEqual(base64.b64decode(kwargs["json"]["body_base64"]),
                         b'{"unicode":"\xe2\x82\xac"}')
        self.assertEqual(kwargs["json"]["headers"]["BTCPay-Sig"], "sha256=fixture")
        self.assertEqual(kwargs["json"]["headers"]["X-Webhook-Secret"], "merchant-secret")
        self.assertNotIn("X-Real-IP", kwargs["json"]["headers"])
        self.assertEqual(kwargs["headers"], {"Authorization": "Bearer " + "s" * 64})
        self.assertFalse(kwargs["allow_redirects"])
        self.assertEqual(kwargs["timeout"], 15)
        self.assertFalse(self.session.trust_env)

    def test_disabled_preserves_direct_delivery(self):
        with patch.dict(os.environ, {"WEBHOOK_RELAY_ENABLED": "false"}):
            self.direct.return_value.status_code = 204
            self.deliver()
        self.direct.assert_called_once()
        self.session.post.assert_not_called()

    def test_invalid_configuration_never_falls_back(self):
        for values in (
            {"WEBHOOK_RELAY_TOKEN": ""}, {"WEBHOOK_RELAY_URL": "http://relay.example/deliver"},
            {"WEBHOOK_RELAY_URL": "https://user:password@relay.example/deliver"},
            {"WEBHOOK_RELAY_ENABLED": "typo"},
            {"WEBHOOK_RELAY_TOKEN": "€" * 32},
        ):
            with self.subTest(values=values), patch.dict(os.environ, values):
                with self.assertRaises(RequestException):
                    self.deliver()
        self.direct.assert_not_called()
        self.session.post.assert_not_called()

    def test_relay_errors_and_bad_results_never_fall_back(self):
        for status in (301, 401, 413, 429, 502, 504):
            self.reply(status=status)
            with self.subTest(status=status), self.assertRaises(RequestException):
                self.deliver()
        for raw in (b"not json", b"[]", b"{}", b'{"version":1,"http_status":true}', b"x" * 65537):
            self.reply(raw=raw)
            with self.subTest(raw=raw[:30]), self.assertRaises(RequestException):
                self.deliver()
        self.session.post.side_effect = RequestException("secret transport details")
        with self.assertRaisesRegex(RequestException, "^Webhook relay delivery failed$"):
            self.deliver()
        self.direct.assert_not_called()

    def test_recipient_errors_are_returned_as_recipient_status(self):
        for code in (400, 429, 500, 503):
            self.reply(code)
            self.assertEqual(self.deliver().status_code, code)

    def test_relay_destination_rejection_is_unsafe_url(self):
        self.reply(status=422)
        with self.assertRaises(UnsafeWebhookUrl):
            self.deliver()
        self.direct.assert_not_called()

    def test_redirects_use_relay_and_keep_body(self):
        self.reply(302, location="/final")
        first = self.session.post.return_value
        self.reply(204)
        second = self.session.post.return_value
        self.session.post.side_effect = [first, second]
        self.assertEqual(self.deliver().status_code, 204)
        calls = self.session.post.call_args_list
        self.assertEqual(calls[1].kwargs["json"]["url"], "https://merchant.example/final")
        self.assertEqual(calls[0].kwargs["json"]["body_base64"], calls[1].kwargs["json"]["body_base64"])
        self.direct.assert_not_called()

    def test_unsafe_redirect_is_blocked_before_next_attempt(self):
        self.reply(302, location="http://private.example/events")
        with self.assertRaises(UnsafeWebhookUrl):
            self.deliver()
        self.session.post.assert_called_once()
        self.direct.assert_not_called()

    def test_redirect_limit_remains_three(self):
        self.reply(302, location="/again")
        self.assertIsNone(self.deliver())
        self.assertEqual(self.session.post.call_count, 4)

    def test_self_delivery_literal_ip_and_oversized_payload_are_blocked(self):
        with patch.dict(os.environ, {"WEBHOOK_RELAY_URL": "https://merchant.example/deliver"}):
            with self.assertRaises(UnsafeWebhookUrl):
                self.deliver()
        with self.assertRaises(UnsafeWebhookUrl):
            post_webhook_with_redirects("https://8.8.8.8/events", data=b"{}", headers={}, timeout=5)
        with self.assertRaises(RequestException):
            self.deliver(data=b"x" * (1024 * 1024 + 1))
        self.session.post.assert_not_called()
        self.direct.assert_not_called()
