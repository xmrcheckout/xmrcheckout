import socket
import unittest
from unittest.mock import Mock, patch

from app.webhook_http import (
    UnsafeWebhookUrl,
    post_webhook_with_redirects,
    validate_webhook_url,
)


def _address_result(address):
    family = socket.AF_INET6 if ":" in address else socket.AF_INET
    sockaddr = (address, 443, 0, 0) if family == socket.AF_INET6 else (address, 443)
    return (family, socket.SOCK_STREAM, 6, "", sockaddr)


class WebhookUrlValidationTests(unittest.TestCase):
    @patch("app.webhook_http.socket.getaddrinfo")
    def test_public_https_ipv4_and_ipv6_are_allowed(self, getaddrinfo):
        getaddrinfo.return_value = [
            _address_result("8.8.8.8"),
            _address_result("2606:4700:4700::1111"),
        ]

        self.assertEqual(
            validate_webhook_url("https://hooks.example.test/events"),
            "https://hooks.example.test/events",
        )

    @patch("app.webhook_http.socket.getaddrinfo")
    def test_non_https_and_embedded_credentials_are_rejected(self, getaddrinfo):
        for url in (
            "http://hooks.example.test/events",
            "https://user:secret@hooks.example.test/events",
        ):
            with self.subTest(url=url), self.assertRaises(UnsafeWebhookUrl):
                validate_webhook_url(url)
        getaddrinfo.assert_not_called()

    @patch("app.webhook_http.socket.getaddrinfo")
    def test_private_and_special_addresses_are_rejected(self, getaddrinfo):
        for address in (
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "192.0.2.1",
            "224.0.0.1",
            "0.0.0.0",
            "::1",
            "fc00::1",
            "fe80::1",
        ):
            getaddrinfo.return_value = [_address_result(address)]
            with self.subTest(address=address), self.assertRaises(UnsafeWebhookUrl):
                validate_webhook_url("https://hooks.example.test/events")

    @patch("app.webhook_http.socket.getaddrinfo")
    def test_mixed_public_and_private_dns_results_are_rejected(self, getaddrinfo):
        getaddrinfo.return_value = [
            _address_result("8.8.8.8"),
            _address_result("10.0.0.1"),
        ]

        with self.assertRaises(UnsafeWebhookUrl):
            validate_webhook_url("https://hooks.example.test/events")

    @patch("app.webhook_http.socket.getaddrinfo", side_effect=socket.gaierror())
    def test_dns_failure_is_rejected(self, _getaddrinfo):
        with self.assertRaises(UnsafeWebhookUrl):
            validate_webhook_url("https://missing.example.test/events")


class WebhookRedirectTests(unittest.TestCase):
    @staticmethod
    def resolve(host, port, **_kwargs):
        address = "10.0.0.1" if host == "internal.example.test" else "8.8.8.8"
        return [_address_result(address)]

    @patch("app.webhook_http.requests.post")
    @patch("app.webhook_http.socket.getaddrinfo")
    def test_safe_redirect_chain_is_delivered(self, getaddrinfo, post):
        getaddrinfo.side_effect = self.resolve
        redirect = Mock(status_code=302, headers={"Location": "/final"})
        delivered = Mock(status_code=204, headers={})
        post.side_effect = [redirect, delivered]

        response = post_webhook_with_redirects(
            "https://hooks.example.test/start",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            timeout=5,
        )

        self.assertIs(response, delivered)
        self.assertEqual(post.call_count, 2)

    @patch("app.webhook_http.requests.post")
    @patch("app.webhook_http.socket.getaddrinfo")
    def test_redirect_to_private_destination_is_blocked_before_request(
        self,
        getaddrinfo,
        post,
    ):
        getaddrinfo.side_effect = self.resolve
        post.return_value = Mock(
            status_code=302,
            headers={"Location": "https://internal.example.test/secret"},
        )

        with self.assertRaises(UnsafeWebhookUrl):
            post_webhook_with_redirects(
                "https://hooks.example.test/start",
                data=b"{}",
                headers={"Content-Type": "application/json"},
                timeout=5,
            )

        post.assert_called_once()


if __name__ == "__main__":
    unittest.main()
