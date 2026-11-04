import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import threading
import time

from fastapi import HTTPException

from app import routes, webhooks
from app.models import BtcpayWebhook, User, Webhook, WebhookDelivery
from app.webhook_retry import MAX_ATTEMPTS, RETRY_DELAYS, next_attempt_time

NOW = datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc)


class RetryScheduleTests(unittest.TestCase):
    def test_failed_first_attempt_is_retried_after_one_minute(self):
        self.assertEqual(next_attempt_time(1, 503, NOW), NOW + timedelta(minutes=1))
        self.assertEqual(next_attempt_time(1, None, NOW), NOW + timedelta(minutes=1))

    def test_success_and_redirect_codes_are_not_retried(self):
        for status_code in (200, 204, 302):
            self.assertIsNone(next_attempt_time(1, status_code, NOW))

    def test_schedule_stops_after_last_attempt(self):
        self.assertEqual(MAX_ATTEMPTS, len(RETRY_DELAYS) + 1)
        self.assertEqual(
            next_attempt_time(MAX_ATTEMPTS - 1, 500, NOW), NOW + RETRY_DELAYS[-1]
        )
        self.assertIsNone(next_attempt_time(MAX_ATTEMPTS, 500, NOW))


class FakeDb:
    """Return a fixed first() result for each queried model."""

    def __init__(self, results):
        self.results = results
        self.added = []
        self.commit = MagicMock()
        self.rollback = MagicMock()

    def query(self, model):
        query = MagicMock()
        query.filter.return_value = query
        query.with_for_update.return_value = query
        query.first.return_value = self.results.get(model)
        return query

    def add(self, row):
        self.added.append(row)


class RetryDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(id=uuid4())
        self.hook = SimpleNamespace(
            id=uuid4(), active=True, events=["invoice.confirmed"],
            enabled=True, automatic_redelivery=True,
            authorized_events={"everything": True},
        )
        self.delivery = SimpleNamespace(
            id=uuid4(), user_id=self.user.id, webhook_id=self.hook.id, kind="native",
            event="invoice.confirmed", url="https://merchant.example/events",
            invoice_id=uuid4(), invoice_address="fixture-address",
            invoice_subaddress_index=3, invoice_amount_xmr=1, invoice_status="confirmed",
            payload_json={"event": "invoice.confirmed"}, http_status=503,
            error_message=None, attempt=1, next_attempt_at=NOW,
        )
        self.native = self.patch("send_native_webhook", return_value=(204, None))
        self.btcpay = self.patch("send_btcpay_webhook", return_value=(204, None))
        self.patch("_ensure_webhook_secret", return_value="merchant-secret")

    def patch(self, name, **kwargs):
        patcher = patch.object(webhooks, name, **kwargs)
        self.addCleanup(patcher.stop)
        return patcher.start()

    def retry(self, hook_model=Webhook, hook="default"):
        db = FakeDb({
            WebhookDelivery: self.delivery,
            hook_model: self.hook if hook == "default" else hook,
            User: self.user,
        })
        sent = webhooks._retry_delivery(db, self.delivery.id, NOW)
        return db, sent

    def test_due_retry_is_recorded_as_next_attempt(self):
        db, sent = self.retry()

        self.assertTrue(sent)
        self.native.assert_called_once_with(
            self.delivery.url, self.delivery.payload_json, "merchant-secret",
            webhook_id=self.hook.id,
        )
        [row] = db.added
        self.assertEqual(row.attempt, 2)
        self.assertEqual(row.http_status, 204)
        self.assertIsNone(row.next_attempt_at)
        self.assertIsNone(self.delivery.next_attempt_at)
        db.commit.assert_called_once()

    def test_failed_retry_schedules_the_following_attempt(self):
        self.native.return_value = (None, "fixture connection failure")

        db, _ = self.retry()

        [row] = db.added
        self.assertEqual(row.attempt, 2)
        self.assertIsNotNone(row.next_attempt_at)

    def test_last_attempt_does_not_schedule_another(self):
        self.delivery.attempt = MAX_ATTEMPTS - 1
        self.native.return_value = (500, None)

        db, _ = self.retry()

        [row] = db.added
        self.assertEqual(row.attempt, MAX_ATTEMPTS)
        self.assertIsNone(row.next_attempt_at)

    def test_inactive_deleted_or_unsubscribed_hooks_cancel_the_retry(self):
        for hook in (
            None,
            SimpleNamespace(**{**vars(self.hook), "active": False}),
            SimpleNamespace(**{**vars(self.hook), "events": ["invoice.created"]}),
        ):
            with self.subTest(hook=hook):
                self.delivery.next_attempt_at = NOW
                db, sent = self.retry(hook=hook)

                self.assertFalse(sent)
                self.native.assert_not_called()
                self.assertEqual(db.added, [])
                self.assertIsNone(self.delivery.next_attempt_at)
                db.commit.assert_called_once()

    def test_btcpay_retry_uses_signed_sender(self):
        self.delivery.kind = "btcpay"
        self.delivery.event = "InvoiceSettled"

        db, sent = self.retry(hook_model=BtcpayWebhook)

        self.assertTrue(sent)
        self.btcpay.assert_called_once_with(
            self.hook, self.delivery.url, self.delivery.payload_json
        )
        self.native.assert_not_called()
        self.assertEqual(db.added[0].kind, "btcpay")

    def test_btcpay_retry_respects_automatic_redelivery_flag(self):
        self.delivery.kind = "btcpay"
        self.hook.automatic_redelivery = False

        db, sent = self.retry(hook_model=BtcpayWebhook)

        self.assertFalse(sent)
        self.btcpay.assert_not_called()

    def test_row_already_claimed_is_skipped(self):
        db = FakeDb({WebhookDelivery: None})

        self.assertFalse(webhooks._retry_delivery(db, self.delivery.id, NOW))
        self.native.assert_not_called()

    def test_sweep_continues_after_one_retry_raises(self):
        db = MagicMock()
        ids = [SimpleNamespace(id=uuid4(), user_id=uuid4()) for _ in range(2)]
        db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = ids
        with patch.object(webhooks, "_retry_delivery", side_effect=[RuntimeError("boom"), True]) as retry:
            sent = webhooks.retry_due_deliveries(db, now=NOW)

        self.assertEqual(sent, 1)
        self.assertEqual(retry.call_count, 2)


    def queued(self):
        self.delivery.attempt = 0
        self.delivery.http_status = None

    def test_queued_delivery_gets_its_first_attempt_in_place(self):
        self.queued()

        db, sent = self.retry()

        self.assertTrue(sent)
        self.native.assert_called_once()
        self.assertEqual(db.added, [])
        self.assertEqual(self.delivery.attempt, 1)
        self.assertEqual(self.delivery.http_status, 204)
        self.assertIsNone(self.delivery.next_attempt_at)

    def test_failed_first_attempt_is_scheduled_for_retry(self):
        self.queued()
        self.native.return_value = (None, "fixture connection failure")

        self.retry()

        self.assertEqual(self.delivery.attempt, 1)
        self.assertIsNotNone(self.delivery.next_attempt_at)

    def test_btcpay_first_attempt_is_sent_even_without_automatic_redelivery(self):
        self.queued()
        self.delivery.kind = "btcpay"
        self.hook.automatic_redelivery = False
        self.btcpay.return_value = (500, None)

        _, sent = self.retry(hook_model=BtcpayWebhook)

        self.assertTrue(sent)
        self.btcpay.assert_called_once()
        self.assertEqual(self.delivery.http_status, 500)
        self.assertIsNone(self.delivery.next_attempt_at)

    def test_slow_receiver_is_abandoned_at_the_deadline(self):
        self.queued()
        self.native.side_effect = lambda *args, **kwargs: time.sleep(0.5) or (204, None)
        self.addCleanup(webhooks._overdue_sends.clear)
        with patch.object(webhooks, "DELIVERY_DEADLINE_SECONDS", 0.05):
            started = time.monotonic()
            self.retry()

        self.assertLess(time.monotonic() - started, 0.4)
        self.assertIsNone(self.delivery.http_status)
        self.assertEqual(self.delivery.error_message, "Webhook delivery timed out")
        self.assertIsNotNone(self.delivery.next_attempt_at)
        self.assertIn(str(self.user.id), webhooks._overdue_sends)


class SweepFairnessTests(unittest.TestCase):
    def sweep(self, rows):
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = rows
        with patch.object(webhooks, "_retry_delivery", return_value=True) as retry:
            webhooks.retry_due_deliveries(db, now=NOW)
        return [call.args[1] for call in retry.call_args_list]

    def test_one_merchant_is_capped_and_others_still_go_out(self):
        busy, quiet = uuid4(), uuid4()
        rows = [SimpleNamespace(id=uuid4(), user_id=busy) for _ in range(20)]
        rows.append(SimpleNamespace(id=uuid4(), user_id=quiet))

        sent = self.sweep(rows)

        self.assertEqual(len(sent), webhooks.MAX_DELIVERIES_PER_MERCHANT + 1)
        self.assertIn(rows[-1].id, sent)

    def test_merchant_with_overdue_attempt_is_skipped_until_it_finishes(self):
        stuck, other = uuid4(), uuid4()
        release = threading.Event()
        future = webhooks._SEND_POOL.submit(release.wait)
        webhooks._overdue_sends[str(stuck)] = future
        self.addCleanup(webhooks._overdue_sends.clear)
        rows = [SimpleNamespace(id=uuid4(), user_id=stuck),
                SimpleNamespace(id=uuid4(), user_id=other)]

        self.assertEqual(self.sweep(rows), [rows[1].id])
        release.set()
        future.result(timeout=1)
        self.assertEqual(self.sweep(rows), [rows[0].id, rows[1].id])


class ManualRedeliveryTests(unittest.TestCase):
    def test_queued_delivery_cannot_be_redelivered(self):
        delivery = SimpleNamespace(http_status=None, attempt=0)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = delivery
        with patch.object(routes, "_get_user_for_api_key", return_value=SimpleNamespace(id=uuid4())):
            with self.assertRaises(HTTPException) as raised:
                routes.redeliver_webhook_delivery(uuid4(), db=db, api_key="fixture-key")
        self.assertEqual(raised.exception.status_code, 409)

    def test_manual_redelivery_cancels_pending_automatic_retry(self):
        delivery = SimpleNamespace(
            http_status=500, payload_json={"event": "invoice.confirmed"},
            invoice_id=uuid4(), url="https://merchant.example/events", webhook_id=uuid4(),
            event="invoice.confirmed", invoice_address="fixture-address",
            invoice_subaddress_index=1, invoice_amount_xmr=1, invoice_status="confirmed",
            next_attempt_at=NOW, attempt=1,
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = delivery
        with patch.object(routes, "_get_user_for_api_key", return_value=SimpleNamespace(id=uuid4())), \
                patch.object(routes, "_ensure_webhook_secret", return_value="merchant-secret"), \
                patch.object(routes, "post_webhook_with_redirects",
                             return_value=SimpleNamespace(status_code=204)):
            routes.redeliver_webhook_delivery(uuid4(), db=db, api_key="fixture-key")

        self.assertIsNone(delivery.next_attempt_at)
        redelivery = db.add.call_args.args[0]
        self.assertIsNone(redelivery.next_attempt_at)


if __name__ == "__main__":
    unittest.main()
