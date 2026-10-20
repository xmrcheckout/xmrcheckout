import unittest
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from requests import RequestException

from app import btcpay_webhooks
from app.webhook_http import UnsafeWebhookUrl


class BtcpayWebhookRetryTests(unittest.TestCase):
    def setUp(self):
        self.hook = SimpleNamespace(
            id="fixture-hook",
            url="https://hooks.example.test/events",
            secret_encrypted="fixture-encrypted-secret",
            authorized_events={"everything": True},
        )
        self.db = Mock()
        self.db.query.return_value.filter.return_value.all.return_value = [self.hook]
        self.invoice = SimpleNamespace(id="fixture-invoice")
        self.post = self.patch("post_webhook_with_redirects")
        self.post.return_value = Mock(status_code=204)
        self.sleep = self.patch("time.sleep")
        self.logger = self.patch("logger")
        self.patch("decrypt_secret").return_value = "fixture-secret"
        self.patch("_build_payload").return_value = {
            "type": "InvoiceProcessing",
            "invoiceId": self.invoice.id,
            "timestamp": 123,
        }

    def patch(self, name):
        patcher = patch("app.btcpay_webhooks." + name)
        self.addCleanup(patcher.stop)
        return patcher.start()

    def dispatch(self):
        btcpay_webhooks.dispatch_btcpay_webhooks(
            self.db, "fixture-user", "InvoiceProcessing", self.invoice
        )

    def test_success_is_not_retried(self):
        self.dispatch()

        self.post.assert_called_once()
        self.assertEqual(self.post.call_args.kwargs["timeout"], 10)
        self.sleep.assert_not_called()

    def test_server_error_is_retried_with_same_payload_and_signature(self):
        self.post.side_effect = [Mock(status_code=503), Mock(status_code=204)]

        self.dispatch()

        self.assertEqual(self.post.call_count, 2)
        self.assertEqual(self.post.call_args_list[0], self.post.call_args_list[1])
        self.sleep.assert_called_once_with(1.0)

    def test_mixed_transient_failures_use_one_and_two_second_backoff(self):
        self.post.side_effect = [
            RequestException("fixture connection failure"),
            Mock(status_code=502),
            Mock(status_code=204),
        ]

        self.dispatch()

        self.assertEqual(self.post.call_count, 3)
        self.assertEqual(self.sleep.call_args_list, [call(1.0), call(2.0)])
        self.logger.error.assert_not_called()

    def test_persistent_server_error_stops_after_three_attempts(self):
        self.post.return_value = Mock(status_code=503)

        self.dispatch()

        self.assertEqual(self.post.call_count, 3)
        self.assertEqual(self.sleep.call_args_list, [call(1.0), call(2.0)])
        self.logger.warning.assert_called_once()
        self.assertEqual(self.logger.warning.call_args.kwargs["extra"]["http_status"], 503)

    def test_network_failure_stops_after_three_attempts_and_logs_error(self):
        self.post.side_effect = RequestException("fixture connection failure")

        self.dispatch()

        self.assertEqual(self.post.call_count, 3)
        self.assertEqual(self.sleep.call_args_list, [call(1.0), call(2.0)])
        self.logger.error.assert_called_once()

    def test_client_errors_are_not_retried(self):
        for status_code in (400, 401, 429):
            with self.subTest(status_code=status_code):
                self.post.reset_mock()
                self.post.return_value = Mock(status_code=status_code)

                self.dispatch()

                self.post.assert_called_once()
                self.sleep.assert_not_called()

    def test_redirect_failure_stops_after_three_attempts(self):
        self.post.return_value = None

        self.dispatch()

        self.assertEqual(self.post.call_count, 3)
        self.assertEqual(self.sleep.call_args_list, [call(1.0), call(2.0)])
        self.logger.warning.assert_called_once()

    def test_unsafe_destination_is_not_retried(self):
        self.post.side_effect = UnsafeWebhookUrl("fixture blocked destination")

        self.dispatch()

        self.post.assert_called_once()
        self.sleep.assert_not_called()
        self.logger.warning.assert_called_once()

    def test_exhausted_hook_does_not_prevent_next_hook_delivery(self):
        other = SimpleNamespace(**{**vars(self.hook), "id": "second-hook"})
        self.db.query.return_value.filter.return_value.all.return_value = [self.hook, other]
        self.post.side_effect = [
            RequestException("fixture connection failure"),
            RequestException("fixture connection failure"),
            RequestException("fixture connection failure"),
            Mock(status_code=204),
        ]

        self.dispatch()

        self.assertEqual(self.post.call_count, 4)
        self.logger.error.assert_called_once()


if __name__ == "__main__":
    unittest.main()
