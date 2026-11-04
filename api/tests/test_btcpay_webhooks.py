import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

from requests import RequestException

from app import btcpay_webhooks
from app.webhook_http import UnsafeWebhookUrl


class BtcpayWebhookDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.hook = SimpleNamespace(
            id=uuid4(),
            url="https://hooks.example.test/events",
            secret_encrypted="fixture-encrypted-secret",
            authorized_events={"everything": True},
            automatic_redelivery=True,
        )
        self.db = Mock()
        self.db.query.return_value.filter.return_value.all.return_value = [self.hook]
        self.invoice = SimpleNamespace(id=uuid4())
        self.post = self.patch("post_webhook_with_redirects")
        self.post.return_value = Mock(status_code=204)
        self.logger = self.patch("logger")
        self.patch("decrypt_secret").return_value = "fixture-secret"
        self.patch("_build_payload").return_value = {
            "type": "InvoiceProcessing",
            "invoiceId": str(self.invoice.id),
            "timestamp": 123,
        }

    def patch(self, name):
        patcher = patch("app.btcpay_webhooks." + name)
        self.addCleanup(patcher.stop)
        return patcher.start()

    def dispatch(self):
        btcpay_webhooks.dispatch_btcpay_webhooks(
            self.db, str(uuid4()), "InvoiceProcessing", self.invoice
        )

    def recorded(self):
        return self.db.add_all.call_args.args[0]

    def test_queued_dispatch_records_without_sending(self):
        btcpay_webhooks.dispatch_btcpay_webhooks(
            self.db, str(uuid4()), "InvoiceProcessing", self.invoice, queue=True
        )

        self.post.assert_not_called()
        [delivery] = self.recorded()
        self.assertEqual(delivery.attempt, 0)
        self.assertIsNone(delivery.http_status)
        self.assertIsNotNone(delivery.next_attempt_at)

    def test_success_is_recorded_without_retry(self):
        self.dispatch()

        self.post.assert_called_once()
        self.assertEqual(self.post.call_args.kwargs["timeout"], 10)
        [delivery] = self.recorded()
        self.assertEqual(delivery.kind, "btcpay")
        self.assertEqual(delivery.http_status, 204)
        self.assertEqual(delivery.attempt, 1)
        self.assertIsNone(delivery.next_attempt_at)
        self.db.commit.assert_called_once()

    def test_failures_are_attempted_once_and_scheduled_for_retry(self):
        before = datetime.now(timezone.utc)
        for outcome in (
            Mock(status_code=503),
            Mock(status_code=400),
            None,
            RequestException("fixture connection failure"),
            UnsafeWebhookUrl("fixture blocked destination"),
        ):
            with self.subTest(outcome=outcome):
                self.post.reset_mock(side_effect=True, return_value=True)
                if isinstance(outcome, Exception):
                    self.post.side_effect = outcome
                else:
                    self.post.return_value = outcome

                self.dispatch()

                self.post.assert_called_once()
                [delivery] = self.recorded()
                self.assertTrue(delivery.http_status is None or delivery.http_status >= 400)
                self.assertGreater(delivery.next_attempt_at, before)

    def test_automatic_redelivery_disabled_records_without_retry(self):
        self.hook.automatic_redelivery = False
        self.post.return_value = Mock(status_code=503)

        self.dispatch()

        [delivery] = self.recorded()
        self.assertEqual(delivery.http_status, 503)
        self.assertIsNone(delivery.next_attempt_at)

    def test_failed_hook_does_not_prevent_next_hook_delivery(self):
        other = SimpleNamespace(**{**vars(self.hook), "id": uuid4()})
        self.db.query.return_value.filter.return_value.all.return_value = [self.hook, other]
        self.post.side_effect = [
            RequestException("fixture connection failure"),
            Mock(status_code=204),
        ]

        self.dispatch()

        self.assertEqual(self.post.call_count, 2)
        self.assertEqual([d.http_status for d in self.recorded()], [None, 204])

    def test_unauthorized_event_is_not_sent_or_recorded(self):
        self.hook.authorized_events = {"specificEvents": ["InvoiceSettled"]}

        self.dispatch()

        self.post.assert_not_called()
        self.db.add_all.assert_not_called()


if __name__ == "__main__":
    unittest.main()
