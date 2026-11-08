import logging
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException
from requests import RequestException
from sqlalchemy.exc import OperationalError

from app import (
    btcpay_routes,
    btcpay_webhooks,
    monero_service,
    reconciler,
    reclassify_invoice_timing,
    routes,
)
from app.models import Invoice, InvoiceTransfer, SystemStatus, User
from app.monero_service import MoneroWalletService, TransferDetail, WalletBackend
from app.payment_timing import PaymentTiming, classify_payment_timing, effective_confirmations


class _FakeQuery:
    def __init__(self, model, invoices, user, transfers, db=None):
        self.db = db
        self.model = model
        self.invoices = invoices
        self.user = user
        self.transfers = transfers

    def filter(self, *_args, **_kwargs):
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        if self.model is Invoice:
            return self.invoices
        if self.model is InvoiceTransfer:
            return sorted(
                (transfer for transfer in self.transfers if transfer.amount_atomic > 0),
                key=lambda transfer: (transfer.created_at, transfer.txid),
            )
        return []

    def update(self, values, **_kwargs):
        self.db.updates.append(values)
        return 0

    def first(self):
        if self.model is Invoice:
            return self.invoices[0] if self.invoices else None
        return self.user if self.model is User else None


class _FakeDb:
    def __init__(self, invoices, user, transfers=None):
        self.invoices = invoices
        self.user = user
        self.transfers = transfers or []
        self.deleted = []
        self.updates = []

    def query(self, model):
        return _FakeQuery(model, self.invoices, self.user, self.transfers, self)

    def add(self, _value):
        return None

    def delete(self, _value):
        self.deleted.append(_value)
        return None

    def commit(self):
        return None

    def close(self):
        return None


@contextmanager
def _acquired_invoice_lock(_invoice_id):
    yield True


def _pending_invoice(identifier, user_id):
    return SimpleNamespace(
        id=identifier,
        user_id=user_id,
        address=f"address-{identifier}",
        amount_xmr=Decimal("1"),
        status="pending",
        confirmation_target=1,
        confirmations=0,
        total_paid_atomic=None,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        detected_at=None,
        confirmed_at=None,
        paid_after_expiry=False,
        paid_after_expiry_at=None,
        terminal_id=None,
        created_at=datetime.now(timezone.utc),
    )


class ReconcileSummaryTests(unittest.TestCase):
    def test_split_payment_waits_for_value_backed_confirmations(self):
        user_id = "user-1"
        invoice = _pending_invoice("split", user_id)
        user = SimpleNamespace(
            id=user_id,
            payment_address="merchant-address",
            view_key_encrypted="encrypted-view-key",
        )
        db = _FakeDb([invoice], user)
        service = Mock()
        service.get_transfers_for_address.return_value = [
            TransferDetail("old", 500_000_000_000, 10, None, invoice.address),
            TransferDetail("new", 500_000_000_000, 0, None, invoice.address),
        ]

        with (
            patch.object(reconciler, "SessionLocal", return_value=db),
            patch.object(reconciler, "_invoice_advisory_lock", _acquired_invoice_lock),
            patch.object(reconciler, "dispatch_webhooks"),
            patch.object(reconciler, "dispatch_btcpay_webhooks"),
        ):
            reconciler._reconcile_invoices(service)

        self.assertEqual(invoice.status, "payment_detected")
        self.assertEqual(invoice.confirmations, 0)

    def test_reconcile_uses_onchain_time_for_late_detection(self):
        user_id = "user-1"
        expiry = datetime(2026, 8, 19, 7, 51, 58, tzinfo=timezone.utc)
        invoice = SimpleNamespace(
            id="invoice-one",
            user_id=user_id,
            address="invoice-address",
            amount_xmr=Decimal("1"),
            status="expired",
            confirmation_target=1,
            confirmations=0,
            total_paid_atomic=None,
            expires_at=expiry,
            detected_at=None,
            confirmed_at=None,
            paid_after_expiry=True,
            paid_after_expiry_at=expiry + timedelta(days=1),
        )
        user = SimpleNamespace(
            id=user_id,
            payment_address="merchant-address",
            view_key_encrypted="encrypted-view-key",
        )
        db = _FakeDb([invoice], user)
        service = Mock()
        service.get_transfers_for_address.return_value = [
            TransferDetail(
                txid="transfer-one",
                amount_atomic=1_000_000_000_000,
                confirmations=2,
                timestamp=int((expiry - timedelta(days=1)).timestamp()),
                address="invoice-address",
            )
        ]

        with (
            patch.object(reconciler, "SessionLocal", return_value=db),
            patch.object(reconciler, "_invoice_advisory_lock", _acquired_invoice_lock),
            patch.object(reconciler, "dispatch_webhooks"),
            patch.object(reconciler, "dispatch_btcpay_webhooks"),
        ):
            summary = reconciler._reconcile_invoices(service)

        self.assertEqual(summary, reconciler.ReconcileSummary(1, 1, 0))
        self.assertEqual(invoice.status, "confirmed")
        self.assertFalse(invoice.paid_after_expiry)
        self.assertIsNone(invoice.paid_after_expiry_at)

    def test_partial_wallet_failure_is_counted(self):
        user_id = "user-1"
        invoices = [_pending_invoice("one", user_id), _pending_invoice("two", user_id)]
        user = SimpleNamespace(
            id=user_id,
            payment_address="merchant-address",
            view_key_encrypted="encrypted-view-key",
        )
        db = _FakeDb(invoices, user)
        service = Mock()
        service.get_transfers_for_address.side_effect = [[], RuntimeError("rpc failed")]

        with (
            patch.object(reconciler, "SessionLocal", return_value=db),
            patch.object(reconciler, "_invoice_advisory_lock", _acquired_invoice_lock),
        ):
            summary = reconciler._reconcile_invoices(service)

        self.assertEqual(summary.attempted, 2)
        self.assertEqual(summary.succeeded, 1)
        self.assertEqual(summary.failed, 1)

    def test_wallet_readiness_failure_skips_user_group_once(self):
        user_id = "user-1"
        invoices = [_pending_invoice("one", user_id), _pending_invoice("two", user_id)]
        user = SimpleNamespace(
            id=user_id,
            payment_address="merchant-address",
            view_key_encrypted="encrypted-view-key",
        )
        db = _FakeDb(invoices, user)
        service = Mock()
        service.ensure_wallet_ready.side_effect = HTTPException(
            status_code=503,
            detail="View-only wallet is still syncing",
        )

        with (
            patch.object(reconciler, "SessionLocal", return_value=db),
            patch.object(reconciler, "_invoice_advisory_lock", _acquired_invoice_lock),
        ):
            summary = reconciler._reconcile_invoices(service)

        self.assertEqual(summary.attempted, 2)
        self.assertEqual(summary.succeeded, 0)
        self.assertEqual(summary.failed, 2)
        service.ensure_wallet_ready.assert_called_once_with(user)
        service.get_transfers_for_address.assert_not_called()

    def test_transient_transfer_read_is_retried(self):
        service = Mock()
        service.get_transfers_for_address.side_effect = [
            HTTPException(status_code=503, detail="wallet busy"),
            [TransferDetail("tx-one", 100, 1, None, "address-one")],
        ]

        with patch.object(reconciler.time, "sleep") as sleep:
            transfers = reconciler._get_transfers_with_retry(
                service,
                user=SimpleNamespace(id="user-one"),
                address="address-one",
            )

        self.assertEqual(len(transfers), 1)
        self.assertEqual(service.get_transfers_for_address.call_count, 2)
        sleep.assert_called_once_with(0.5)

    def test_final_transfer_read_failure_preserves_stored_state(self):
        invoice = _pending_invoice("failed", "user-one")
        stored_transfer = SimpleNamespace(
            txid="known-transfer",
            amount_atomic=100,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db = _FakeDb([], None, [stored_transfer])
        service = Mock()
        service.get_transfers_for_address.side_effect = HTTPException(
            status_code=502,
            detail="malformed transfer response",
        )

        result = reconciler._reconcile_invoice(
            db,
            service,
            SimpleNamespace(id="user-one"),
            invoice,
        )

        self.assertFalse(result)
        self.assertEqual(db.deleted, [])
        self.assertIsNone(invoice.total_paid_atomic)


class TransferPreservationTests(unittest.TestCase):
    def test_empty_response_preserves_stored_transfers(self):
        stored = SimpleNamespace(txid="previously-detected")
        invoice = _pending_invoice("invoice-one", "user-one")
        db = _FakeDb([invoice], None, transfers=[])
        db.query = Mock()
        db.query.return_value.filter.return_value.all.return_value = [stored]

        changed = reconciler._sync_invoice_transfers(
            db, invoice=invoice, transfers=[]
        )

        self.assertFalse(changed)
        self.assertEqual(db.deleted, [])

    def test_nonempty_response_still_prunes_missing_transfers(self):
        stale = SimpleNamespace(txid="no-longer-returned")
        existing = SimpleNamespace(
            txid="still-returned",
            amount_atomic=100,
            confirmations=2,
            timestamp=123,
            address="invoice-address",
        )
        invoice = _pending_invoice("invoice-one", "user-one")
        db = _FakeDb([invoice], None, transfers=[])
        db.query = Mock()
        db.query.return_value.filter.return_value.all.return_value = [stale, existing]

        changed = reconciler._sync_invoice_transfers(
            db,
            invoice=invoice,
            transfers=[TransferDetail("still-returned", 100, 2, 123, "invoice-address")],
        )

        self.assertTrue(changed)
        self.assertEqual(db.deleted, [stale])

    def test_nonempty_response_updates_existing_transfer(self):
        existing = SimpleNamespace(
            txid="still-returned",
            amount_atomic=100,
            confirmations=1,
            timestamp=123,
            address="invoice-address",
        )
        invoice = _pending_invoice("invoice-one", "user-one")
        db = _FakeDb([invoice], None, transfers=[])
        db.query = Mock()
        db.query.return_value.filter.return_value.all.return_value = [existing]

        changed = reconciler._sync_invoice_transfers(
            db,
            invoice=invoice,
            transfers=[TransferDetail("still-returned", 100, 3, 123, "invoice-address")],
        )

        self.assertTrue(changed)
        self.assertEqual(existing.confirmations, 3)
        self.assertEqual(db.deleted, [])


class PaymentTimingTests(unittest.TestCase):
    expiry = datetime(2026, 8, 19, 7, 51, 58, tzinfo=timezone.utc)

    @staticmethod
    def transfer(identifier, amount, timestamp):
        return TransferDetail(
            txid=identifier,
            amount_atomic=amount,
            confirmations=1,
            timestamp=timestamp,
            address=None,
        )

    def test_pre_expiry_payment_detected_late_is_on_time(self):
        timing = classify_payment_timing(
            transfers=[self.transfer("one", 100, 1786521950)],
            required_atomic=100,
            expires_at=self.expiry,
            detection_fallback_at=self.expiry + timedelta(days=6),
        )

        self.assertIsNotNone(timing)
        self.assertFalse(timing.paid_after_expiry)
        self.assertIsNone(timing.paid_after_expiry_at)
        self.assertFalse(timing.used_detection_fallback)

    def test_partial_payments_use_threshold_crossing_time(self):
        before = int((self.expiry - timedelta(minutes=1)).timestamp())
        after = int((self.expiry + timedelta(minutes=1)).timestamp())
        timing = classify_payment_timing(
            transfers=[
                self.transfer("later", 60, after),
                self.transfer("earlier", 40, before),
            ],
            required_atomic=100,
            expires_at=self.expiry,
            detection_fallback_at=self.expiry + timedelta(hours=1),
        )

        self.assertIsNotNone(timing)
        self.assertTrue(timing.paid_after_expiry)
        self.assertEqual(
            timing.paid_after_expiry_at,
            self.expiry + timedelta(minutes=1),
        )

    def test_zero_and_negative_transfers_are_ignored(self):
        before = int((self.expiry - timedelta(minutes=1)).timestamp())
        timing = classify_payment_timing(
            transfers=[
                self.transfer("zero", 0, None),
                self.transfer("negative", -100, None),
                self.transfer("paid", 100, before),
            ],
            required_atomic=100,
            expires_at=self.expiry,
            detection_fallback_at=self.expiry + timedelta(hours=1),
        )

        self.assertIsNotNone(timing)
        self.assertFalse(timing.paid_after_expiry)
        self.assertFalse(timing.used_detection_fallback)

    def test_missing_timestamp_uses_detection_fallback(self):
        detected_at = self.expiry + timedelta(minutes=2)
        timing = classify_payment_timing(
            transfers=[self.transfer("unknown", 100, None)],
            required_atomic=100,
            expires_at=self.expiry,
            detection_fallback_at=detected_at,
        )

        self.assertIsNotNone(timing)
        self.assertTrue(timing.paid_after_expiry)
        self.assertEqual(timing.paid_after_expiry_at, detected_at)
        self.assertTrue(timing.used_detection_fallback)

    def test_underpayment_has_no_payment_timing(self):
        timing = classify_payment_timing(
            transfers=[self.transfer("partial", 99, int(self.expiry.timestamp()))],
            required_atomic=100,
            expires_at=self.expiry,
            detection_fallback_at=self.expiry,
        )

        self.assertIsNone(timing)


class EffectiveConfirmationTests(unittest.TestCase):
    @staticmethod
    def transfer(identifier, amount, confirmations):
        return TransferDetail(identifier, amount, confirmations, None, None)

    def test_single_transfer_uses_its_confirmation_depth(self):
        result = effective_confirmations([self.transfer("one", 100, 4)], 100)
        self.assertEqual(result, 4)

    def test_split_payment_uses_depth_securing_full_amount(self):
        result = effective_confirmations(
            [self.transfer("old", 40, 12), self.transfer("new", 60, 1)],
            100,
        )
        self.assertEqual(result, 1)

    def test_unconfirmed_excess_does_not_reduce_fully_secured_amount(self):
        result = effective_confirmations(
            [self.transfer("paid", 100, 8), self.transfer("excess", 20, 0)],
            100,
        )
        self.assertEqual(result, 8)

    def test_underpayment_and_non_positive_transfers_return_zero(self):
        result = effective_confirmations(
            [
                self.transfer("partial", 99, 10),
                self.transfer("zero", 0, 20),
                self.transfer("out", -100, 20),
            ],
            100,
        )
        self.assertEqual(result, 0)


class BtcpayTimingTests(unittest.TestCase):
    def test_payment_observation_evidence_is_stable_and_positive_only(self):
        observed_one = datetime(2026, 8, 26, 10, 0, tzinfo=timezone.utc)
        observed_two = datetime(2026, 8, 26, 10, 1, tzinfo=timezone.utc)
        invoice = SimpleNamespace(
            id="invoice-one",
            confirmation_target=3,
            confirmations=2,
        )
        db = _FakeDb(
            [],
            None,
            [
                SimpleNamespace(
                    txid="tx-b",
                    amount_atomic=50,
                    created_at=observed_two,
                    updated_at=None,
                ),
                SimpleNamespace(
                    txid="tx-a",
                    amount_atomic=100,
                    created_at=observed_one,
                    updated_at=observed_two,
                ),
                SimpleNamespace(
                    txid="ignored-negative",
                    amount_atomic=-1,
                    created_at=observed_two,
                    updated_at=observed_two,
                ),
            ],
        )

        evidence = btcpay_webhooks.payment_observation_evidence(db, invoice)
        payload = btcpay_webhooks._build_payload(
            db=db,
            event_type="InvoiceSettled",
            user_id="user-one",
            invoice=SimpleNamespace(
                id="invoice-one",
                status="confirmed",
                amount_xmr=Decimal("0.0000000001"),
                paid_after_expiry=False,
                metadata_json={},
                confirmation_target=3,
                confirmations=2,
            ),
            manually_marked=False,
        )

        self.assertEqual(evidence["confirmationsRequired"], 3)
        self.assertEqual(evidence["confirmationsObserved"], 2)
        self.assertEqual(evidence["transactionIds"], ["tx-a", "tx-b"])
        self.assertEqual(evidence["observedAt"], observed_two.isoformat())
        self.assertEqual(evidence["observationSource"], "xmrcheckout wallet-rpc")
        self.assertEqual(payload["transactionIds"], evidence["transactionIds"])

    def test_invoice_get_response_exposes_empty_observation_evidence(self):
        invoice_id = "00000000-0000-0000-0000-000000000001"
        user = SimpleNamespace(id="user-one")
        invoice = SimpleNamespace(
            id=invoice_id,
            user_id=user.id,
            amount_xmr=Decimal("1"),
            status="pending",
            total_paid_atomic=0,
            paid_after_expiry=False,
            metadata_json={},
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            archived_at=None,
            confirmation_target=1,
            confirmations=0,
        )
        db = _FakeDb([invoice], user)
        request = SimpleNamespace(
            headers={},
            url=SimpleNamespace(scheme="http"),
        )

        response = btcpay_routes.get_invoice(
            user.id,
            invoice_id,
            request,
            user=user,
            db=db,
        )

        self.assertEqual(response["transactionIds"], [])
        self.assertIsNone(response["observedAt"])
        self.assertEqual(response["confirmationsRequired"], 1)
        self.assertEqual(response["confirmationsObserved"], 0)

    def test_on_time_payment_detected_after_expiry_stays_on_time(self):
        invoice = SimpleNamespace(
            id="invoice-one",
            status="confirmed",
            total_paid_atomic=100,
            amount_xmr=Decimal("0.0000000001"),
            paid_after_expiry=False,
            metadata_json={},
        )

        payload = btcpay_webhooks._build_payload(
            event_type="InvoiceSettled",
            user_id="user-one",
            invoice=invoice,
            manually_marked=False,
        )

        self.assertFalse(payload["afterExpiration"])
        self.assertEqual(btcpay_routes._btcpay_additional_status(invoice), "None")

    def test_onchain_late_payment_is_reported_late(self):
        invoice = SimpleNamespace(
            id="invoice-one",
            status="confirmed",
            total_paid_atomic=100,
            amount_xmr=Decimal("0.0000000001"),
            paid_after_expiry=True,
            metadata_json={},
        )

        payload = btcpay_webhooks._build_payload(
            event_type="InvoiceSettled",
            user_id="user-one",
            invoice=invoice,
            manually_marked=False,
        )

        self.assertTrue(payload["afterExpiration"])
        self.assertEqual(btcpay_routes._btcpay_additional_status(invoice), "PaidLate")


class OutageCatchupTests(unittest.TestCase):
    def test_finished_cycle_with_failures_still_advances_completion(self):
        with patch.object(reconciler, "_safe_update_reconciler_status") as update:
            reconciler._record_cycle_result(Mock(), reconciler.ReconcileSummary(3, 2, 1))
        kwargs = update.call_args.kwargs
        self.assertIsNotNone(kwargs["completed_at"])
        self.assertEqual(kwargs["error_message"], "1 of 3 invoice checks failed")
        self.assertEqual(kwargs["failed_invoices"], 1)

    def test_clean_cycle_clears_error(self):
        with patch.object(reconciler, "_safe_update_reconciler_status") as update:
            reconciler._record_cycle_result(Mock(), reconciler.ReconcileSummary(2, 2, 0))
        self.assertIsNone(update.call_args.kwargs["error_message"])
        self.assertIsNotNone(update.call_args.kwargs["completed_at"])

    def test_only_successful_checks_are_recorded(self):
        user_id = "user-1"
        invoices = [_pending_invoice("one", user_id), _pending_invoice("two", user_id)]
        user = SimpleNamespace(
            id=user_id,
            payment_address="merchant-address",
            view_key_encrypted="encrypted-view-key",
        )
        db = _FakeDb(invoices, user)
        service = Mock()
        service.get_transfers_for_address.side_effect = [[], RuntimeError("rpc failed")]
        recorded = []

        with (
            patch.object(reconciler, "SessionLocal", return_value=db),
            patch.object(reconciler, "_invoice_advisory_lock", _acquired_invoice_lock),
            patch.object(
                reconciler,
                "_record_successful_checks",
                side_effect=lambda _db, ids, _at: recorded.append(list(ids)),
            ),
        ):
            reconciler._reconcile_invoices(service)

        self.assertEqual(recorded, [["one"]])

    def test_record_successful_checks_updates_in_one_statement(self):
        db = _FakeDb([], None)
        checked_at = datetime(2026, 11, 4, tzinfo=timezone.utc)
        reconciler._record_successful_checks(db, ["one", "two"], checked_at)
        reconciler._record_successful_checks(db, [], checked_at)
        self.assertEqual(db.updates, [{Invoice.last_checked_at: checked_at}])


class InvoiceCheckingDelayedTests(unittest.TestCase):
    def _db(self, row):
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = row
        return db

    def _healthy_row(self, now, *, failed=0):
        return SystemStatus(
            name="reconciler",
            last_reconcile_started_at=now - timedelta(seconds=5),
            last_reconcile_completed_at=now - timedelta(seconds=5),
            last_reconcile_error="1 of 2 invoice checks failed" if failed else None,
            last_reconcile_failed_invoices=failed,
        )

    def _invoice(self, now, *, status="pending", last_checked_at=None, age=60):
        return SimpleNamespace(
            status=status,
            last_checked_at=last_checked_at,
            created_at=now - timedelta(seconds=age),
        )

    def test_other_merchants_failures_do_not_delay_this_invoice(self):
        now = datetime.now(timezone.utc)
        db = self._db(self._healthy_row(now, failed=1))
        invoice = self._invoice(now, last_checked_at=now - timedelta(seconds=30))
        self.assertFalse(routes._invoice_checking_delayed(db, invoice, now=now))

    def test_invoice_not_checked_recently_is_delayed(self):
        now = datetime.now(timezone.utc)
        db = self._db(self._healthy_row(now))
        invoice = self._invoice(now, last_checked_at=now - timedelta(minutes=10), age=3600)
        self.assertTrue(routes._invoice_checking_delayed(db, invoice, now=now))

    def test_new_invoice_uses_creation_time(self):
        now = datetime.now(timezone.utc)
        db = self._db(self._healthy_row(now))
        self.assertFalse(routes._invoice_checking_delayed(db, self._invoice(now, age=20), now=now))
        self.assertTrue(routes._invoice_checking_delayed(db, self._invoice(now, age=3600), now=now))

    def test_unavailable_reconciler_delays_every_open_invoice(self):
        now = datetime.now(timezone.utc)
        row = SystemStatus(
            name="reconciler",
            last_reconcile_started_at=now - timedelta(minutes=10),
            last_reconcile_completed_at=now - timedelta(minutes=10),
            last_reconcile_failed_invoices=0,
        )
        invoice = self._invoice(now, last_checked_at=now - timedelta(seconds=30))
        self.assertTrue(routes._invoice_checking_delayed(self._db(row), invoice, now=now))

    def test_closed_invoice_is_never_delayed(self):
        now = datetime.now(timezone.utc)
        db = self._db(None)
        for status in ("confirmed", "expired", "invalid"):
            invoice = self._invoice(now, status=status, age=86400)
            self.assertFalse(routes._invoice_checking_delayed(db, invoice, now=now))


class ReconcilerStatusTests(unittest.TestCase):
    def test_recent_partial_failure_is_degraded(self):
        now = datetime.now(timezone.utc)
        row = SystemStatus(
            name="reconciler",
            last_reconcile_started_at=now,
            last_reconcile_completed_at=now - timedelta(seconds=30),
            last_reconcile_error="1 of 2 invoice checks failed",
            last_reconcile_attempted_invoices=2,
            last_reconcile_succeeded_invoices=1,
            last_reconcile_failed_invoices=1,
        )
        self.assertEqual(routes._reconciler_state(row, now=now), "degraded")

    def test_stale_heartbeat_is_unavailable(self):
        now = datetime.now(timezone.utc)
        row = SystemStatus(
            name="reconciler",
            last_reconcile_started_at=now - timedelta(minutes=5),
            last_reconcile_completed_at=now - timedelta(minutes=5),
            last_reconcile_failed_invoices=0,
        )
        self.assertEqual(routes._reconciler_state(row, now=now), "unavailable")

    def test_recent_complete_cycle_is_ok(self):
        now = datetime.now(timezone.utc)
        row = SystemStatus(
            name="reconciler",
            last_reconcile_started_at=now - timedelta(seconds=10),
            last_reconcile_completed_at=now - timedelta(seconds=5),
            last_reconcile_failed_invoices=0,
        )
        self.assertEqual(routes._reconciler_state(row, now=now), "ok")

    def test_recent_completion_keeps_long_cycle_available(self):
        now = datetime.now(timezone.utc)
        row = SystemStatus(
            name="reconciler",
            last_reconcile_started_at=now - timedelta(minutes=3),
            last_reconcile_completed_at=now - timedelta(seconds=5),
            last_reconcile_failed_invoices=0,
        )
        self.assertEqual(routes._reconciler_state(row, now=now), "ok")

    def test_recent_heartbeat_keeps_running_pass_available(self):
        now = datetime.now(timezone.utc)
        row = SystemStatus(
            name="reconciler",
            last_reconcile_started_at=now - timedelta(minutes=3),
            last_reconcile_completed_at=now - timedelta(minutes=5),
            last_reconcile_failed_invoices=0,
            updated_at=now - timedelta(seconds=10),
        )
        self.assertEqual(routes._reconciler_state(row, now=now), "ok")

    def test_stale_heartbeat_during_pass_is_unavailable(self):
        now = datetime.now(timezone.utc)
        row = SystemStatus(
            name="reconciler",
            last_reconcile_started_at=now - timedelta(minutes=5),
            last_reconcile_completed_at=now - timedelta(minutes=5),
            last_reconcile_failed_invoices=0,
            updated_at=now - timedelta(minutes=5),
        )
        self.assertEqual(routes._reconciler_state(row, now=now), "unavailable")


class ReconcilerHeartbeatTests(unittest.TestCase):
    def _run(self, *, quick):
        user_id = "user-1"
        invoices = [_pending_invoice("one", user_id), _pending_invoice("two", user_id)]
        user = SimpleNamespace(
            id=user_id,
            payment_address="merchant-address",
            view_key_encrypted="encrypted-view-key",
        )
        db = _FakeDb(invoices, user)
        service = Mock()
        service.get_transfers_for_address.return_value = []
        # Every clock read is 20s after the previous one: a slow pass.
        clock = iter(range(0, 10_000, 20))
        with (
            patch.object(reconciler, "SessionLocal", return_value=db),
            patch.object(reconciler, "_invoice_advisory_lock", _acquired_invoice_lock),
            patch.object(reconciler.time, "monotonic", side_effect=lambda: next(clock)),
            patch.object(reconciler, "_send_reconciler_heartbeat") as heartbeat,
        ):
            reconciler._reconcile_invoices(service, quick=quick)
        return heartbeat

    def test_slow_full_pass_sends_heartbeats(self):
        self.assertGreater(self._run(quick=False).call_count, 0)

    def test_quick_checks_send_no_heartbeat(self):
        self.assertEqual(self._run(quick=True).call_count, 0)


class QuickCheckTests(unittest.TestCase):
    def _run(self, invoice, *, wallet_open):
        user = SimpleNamespace(
            id=invoice.user_id,
            payment_address="merchant-address",
            view_key_encrypted="encrypted-view-key",
        )
        service = Mock()
        service.wallet_is_open.return_value = wallet_open
        checked = []
        with (
            patch.object(reconciler, "SessionLocal", return_value=_FakeDb([invoice], user)),
            patch.object(reconciler, "_invoice_advisory_lock", _acquired_invoice_lock),
            patch.object(
                reconciler, "_reconcile_invoice",
                side_effect=lambda _db, _service, _user, inv: checked.append(inv.id) or True,
            ),
        ):
            reconciler._reconcile_invoices(service, quick=True)
        return service, checked

    def test_open_wallet_invoices_are_checked_without_opening_wallets(self):
        service, checked = self._run(_pending_invoice("plain", "user-1"), wallet_open=True)
        self.assertEqual(checked, ["plain"])
        service.refresh_wallet.assert_called_once()
        service.ensure_wallet_ready.assert_not_called()

    def test_closed_wallet_invoices_wait_for_the_full_pass(self):
        service, checked = self._run(_pending_invoice("plain", "user-1"), wallet_open=False)
        self.assertEqual(checked, [])
        service.refresh_wallet.assert_not_called()
        service.ensure_wallet_ready.assert_not_called()

    def test_recent_terminal_sale_is_checked_even_if_wallet_is_closed(self):
        sale = _pending_invoice("sale", "user-1")
        sale.terminal_id = "terminal-1"
        service, checked = self._run(sale, wallet_open=False)
        self.assertEqual(checked, ["sale"])
        service.refresh_wallet.assert_called_once()

    def test_old_terminal_sale_does_not_open_a_closed_wallet(self):
        sale = _pending_invoice("sale", "user-1")
        sale.terminal_id = "terminal-1"
        sale.created_at = datetime.now(timezone.utc) - timedelta(hours=3)
        service, checked = self._run(sale, wallet_open=False)
        self.assertEqual(checked, [])
        service.refresh_wallet.assert_not_called()

    def test_heartbeat_sets_updated_at(self):
        db = Mock()
        row = SystemStatus(name="reconciler")
        db.query.return_value.filter.return_value.first.return_value = row
        at = datetime(2026, 11, 8, 12, 0, tzinfo=timezone.utc)
        reconciler._update_reconciler_status(db, heartbeat_at=at)
        self.assertEqual(row.updated_at, at)
        self.assertIsNone(row.last_reconcile_started_at)
        db.commit.assert_called_once()


class WalletRecoverySafetyTests(unittest.TestCase):
    def test_invoice_lock_key_is_deterministic_and_distinct(self):
        self.assertEqual(
            reconciler._invoice_lock_key("invoice-one"),
            reconciler._invoice_lock_key("invoice-one"),
        )
        self.assertNotEqual(
            reconciler._invoice_lock_key("invoice-one"),
            reconciler._invoice_lock_key("invoice-two"),
        )

    def test_invoice_advisory_lock_releases_dedicated_connection(self):
        connection = Mock()
        connection.execution_options.return_value = connection
        lock_result = Mock()
        lock_result.scalar.return_value = True
        connection.execute.side_effect = [lock_result, Mock()]
        engine = Mock()
        engine.connect.return_value = connection

        with patch.object(reconciler, "engine", engine):
            with reconciler._invoice_advisory_lock("invoice-one") as acquired:
                self.assertTrue(acquired)

        self.assertEqual(connection.execute.call_count, 2)
        connection.close.assert_called_once_with()

    def test_held_invoice_advisory_lock_skips_work(self):
        connection = Mock()
        connection.execution_options.return_value = connection
        lock_result = Mock()
        lock_result.scalar.return_value = False
        connection.execute.return_value = lock_result
        engine = Mock()
        engine.connect.return_value = connection

        with patch.object(reconciler, "engine", engine):
            with reconciler._invoice_advisory_lock("invoice-one") as acquired:
                self.assertFalse(acquired)

        connection.execute.assert_called_once()
        connection.close.assert_called_once_with()

    def test_malformed_transfer_response_is_not_treated_as_empty(self):
        self.assertEqual(
            MoneroWalletService._validated_transfer_lists({"in": [], "pool": []}),
            ([], []),
        )
        self.assertEqual(
            MoneroWalletService._validated_transfer_lists({"in": []}),
            ([], []),
        )
        self.assertEqual(
            MoneroWalletService._validated_transfer_lists({}),
            ([], []),
        )
        self.assertEqual(
            MoneroWalletService._validated_transfer_lists({"pool": []}),
            ([], []),
        )
        with self.assertRaises(HTTPException) as context:
            MoneroWalletService._validated_transfer_lists({"in": [], "pool": {}})
        self.assertEqual(context.exception.status_code, 502)
        with self.assertRaises(HTTPException) as context:
            MoneroWalletService._validated_transfer_lists({"in": {}})
        self.assertEqual(context.exception.status_code, 502)
        with self.assertRaises(HTTPException) as context:
            MoneroWalletService._validated_transfer_lists({"unexpected": []})
        self.assertEqual(context.exception.status_code, 502)

    def test_wallet_rpc_lock_is_released_after_operation(self):
        connection = Mock()
        connection.execution_options.return_value = connection
        connection.execute.return_value.scalar.return_value = "0"
        engine = Mock()
        engine.connect.return_value = connection
        service = object.__new__(MoneroWalletService)
        service._lock_timeout_seconds = 1
        backend = WalletBackend(client=Mock(), url="http://wallet-rpc:18083")

        with patch.object(monero_service, "engine", engine):
            with service._wallet_rpc_lock(backend, operation="test"):
                pass

        statements = [str(call.args[0]) for call in connection.execute.call_args_list]
        self.assertIn("pg_advisory_lock", statements[2])
        self.assertIn("lock_timeout", statements[3])
        self.assertIn("pg_advisory_unlock", statements[4])
        connection.close.assert_called_once_with()

    def test_wallet_rpc_lock_timeout_returns_service_unavailable(self):
        connection = Mock()
        connection.execution_options.return_value = connection

        def execute(statement, *args):
            if "pg_advisory_lock" in str(statement):
                raise OperationalError("SELECT pg_advisory_lock", {}, Exception("lock timeout"))
            return Mock(scalar=Mock(return_value="0"))

        connection.execute.side_effect = execute
        engine = Mock()
        engine.connect.return_value = connection
        service = object.__new__(MoneroWalletService)
        service._lock_timeout_seconds = 0
        backend = WalletBackend(client=Mock(), url="http://wallet-rpc:18083")

        with patch.object(monero_service, "engine", engine):
            with self.assertRaises(HTTPException) as context:
                with service._wallet_rpc_lock(backend, operation="test"):
                    pass

        self.assertEqual(context.exception.status_code, 503)
        statements = [str(call.args[0]) for call in connection.execute.call_args_list]
        self.assertIn("lock_timeout", statements[-1])
        self.assertFalse(any("pg_advisory_unlock" in statement for statement in statements))
        connection.close.assert_called_once_with()

    def test_status_check_does_not_call_wallet_dependent_rpc(self):
        client = Mock()
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._backends = [backend]
        service._daemon_address = "daemon:18081"
        service._daemon_height = Mock(return_value=100)

        result = service.get_status()

        self.assertEqual(result["wallet_rpc"], "ok")
        self.assertEqual(result["daemon"], "ok")
        client.raw_request.assert_called_once_with("get_version")

    def test_status_reports_configured_unreachable_daemon(self):
        client = Mock()
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._backends = [backend]
        service._daemon_address = "daemon:18081"
        service._daemon_height = Mock(return_value=None)

        result = service.get_status()

        self.assertEqual(result["wallet_rpc"], "ok")
        self.assertEqual(result["daemon"], "unreachable")
        client.raw_request.assert_called_once_with("get_version")

    def test_existing_matching_wallet_is_adopted_without_close(self):
        client = Mock()
        client.session.post.return_value.json.return_value = {
            "result": {"address": "merchant-address"}
        }
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)

        service._ensure_wallet_open(
            backend=backend,
            wallet_name="user-wallet",
            payment_address="merchant-address",
            view_key="view-key",
        )

        self.assertEqual(backend.current_wallet, "user-wallet")
        client.raw_request.assert_not_called()

    def test_external_wallet_change_invalidates_local_wallet_cache(self):
        client = Mock()
        client.session.post.return_value.json.return_value = {
            "result": {"address": "merchant-address"}
        }
        backend = WalletBackend(
            client=client,
            url="http://wallet-rpc:18083",
            current_wallet="user-wallet",
        )
        service = object.__new__(MoneroWalletService)

        service._ensure_wallet_open(
            backend=backend,
            wallet_name="user-wallet",
            payment_address="merchant-address",
            view_key="view-key",
        )

        self.assertEqual(backend.current_wallet, "user-wallet")
        client.raw_request.assert_not_called()

    def test_busy_existing_wallet_is_never_closed(self):
        client = Mock()
        client.session.post.side_effect = RequestException("busy")
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)

        with self.assertRaises(HTTPException) as context:
            service._ensure_wallet_open(
                backend=backend,
                wallet_name="user-wallet",
                payment_address="merchant-address",
                view_key="view-key",
            )

        self.assertEqual(context.exception.status_code, 503)
        client.raw_request.assert_not_called()

    def test_new_wallet_generation_uses_restore_height_lookback(self):
        for daemon_height, expected_restore_height in (
            (2000, 560),
            (1440, 0),
            (1000, 0),
            (None, 0),
        ):
            with self.subTest(daemon_height=daemon_height):
                client = Mock()

                def raw_request(method, params=None):
                    if method == "open_wallet":
                        raise RequestException("cache missing")
                    return {}

                client.raw_request.side_effect = raw_request
                backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
                service = object.__new__(MoneroWalletService)
                service._wallet_dir = "/wallets"
                service._daemon_height = Mock(return_value=daemon_height)

                service._ensure_wallet_open(
                    backend=backend,
                    wallet_name="user-wallet",
                    payment_address="merchant-address",
                    view_key="view-key",
                )

                generate_call = next(
                    call for call in client.raw_request.call_args_list
                    if call.args[0] == "generate_from_keys"
                )
                self.assertEqual(
                    generate_call.args[1]["restore_height"], expected_restore_height
                )

    def test_debug_mode_does_not_enable_sensitive_transport_logs(self):
        reconciler._configure_logging(logging.DEBUG)
        self.assertGreaterEqual(
            logging.getLogger("monero.backends.jsonrpc.wallet").level,
            logging.WARNING,
        )
        self.assertGreaterEqual(logging.getLogger("urllib3").level, logging.WARNING)

    def test_unsynced_wallet_is_rejected_before_transfer_read(self):
        client = Mock()
        client.session.post.return_value.json.return_value = {
            "result": {"height": 90}
        }
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._daemon_height = Mock(return_value=100)
        service._ready_timeout_seconds = 0

        with self.assertRaises(HTTPException) as context:
            service._ensure_wallet_synced(backend)

        self.assertEqual(context.exception.status_code, 503)
        self.assertEqual(context.exception.detail, "View-only wallet is still syncing")


class TimingRepairCommandTests(unittest.TestCase):
    def test_dry_run_never_commits_or_changes_invoice(self):
        invoice = SimpleNamespace(
            id="invoice-one",
            paid_after_expiry=True,
            paid_after_expiry_at=datetime.now(timezone.utc),
        )
        timing = PaymentTiming(
            paid_after_expiry=False,
            paid_after_expiry_at=None,
            threshold_reached_at=datetime.now(timezone.utc),
        )
        db = Mock()

        with (
            patch.object(reclassify_invoice_timing, "SessionLocal", return_value=db),
            patch.object(
                reclassify_invoice_timing,
                "_timing_updates",
                return_value=(
                    [reclassify_invoice_timing.TimingUpdate(invoice, timing)],
                    0,
                ),
            ),
            patch("builtins.print"),
        ):
            result = reclassify_invoice_timing.run(apply=False)

        self.assertEqual(result, 0)
        self.assertTrue(invoice.paid_after_expiry)
        db.rollback.assert_called_once()
        db.commit.assert_not_called()

    def test_apply_updates_transaction_without_webhook_dispatch(self):
        invoice = SimpleNamespace(
            id="invoice-one",
            paid_after_expiry=True,
            paid_after_expiry_at=datetime.now(timezone.utc),
        )
        timing = PaymentTiming(
            paid_after_expiry=False,
            paid_after_expiry_at=None,
            threshold_reached_at=datetime.now(timezone.utc),
        )
        db = Mock()

        with (
            patch.object(reclassify_invoice_timing, "SessionLocal", return_value=db),
            patch.object(
                reclassify_invoice_timing,
                "_timing_updates",
                return_value=(
                    [reclassify_invoice_timing.TimingUpdate(invoice, timing)],
                    0,
                ),
            ),
            patch("builtins.print"),
        ):
            result = reclassify_invoice_timing.run(apply=True)

        self.assertEqual(result, 0)
        self.assertFalse(invoice.paid_after_expiry)
        self.assertIsNone(invoice.paid_after_expiry_at)
        db.add.assert_called_once_with(invoice)
        db.commit.assert_called_once()


class WalletSyncSafetyTests(unittest.TestCase):
    def test_synced_wallet_passes_height_guard(self):
        client = Mock()
        client.session.post.return_value.json.return_value = {
            "result": {"height": 100}
        }
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._daemon_height = Mock(return_value=100)

        service._ensure_wallet_synced(backend)

    def test_new_cycle_keeps_open_wallet_and_rechecks_sync(self):
        first = WalletBackend(
            client=Mock(),
            url="http://wallet-rpc-1:18083",
            current_wallet="wallet-one",
            ready_wallet="wallet-one",
        )
        second = WalletBackend(
            client=Mock(),
            url="http://wallet-rpc-2:18083",
            current_wallet="wallet-two",
            ready_wallet="wallet-two",
        )
        service = object.__new__(MoneroWalletService)
        service._backends = [first, second]

        service.begin_reconcile_cycle()

        self.assertEqual(first.current_wallet, "wallet-one")
        self.assertEqual(second.current_wallet, "wallet-two")
        self.assertIsNone(first.ready_wallet)
        self.assertIsNone(second.ready_wallet)

    def test_wallet_sync_waits_for_wallet_to_catch_up(self):
        client = Mock()
        client.session.post.return_value.json.side_effect = [
            {"result": {"height": 90}},
            {"result": {"height": 100}},
        ]
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._daemon_height = Mock(return_value=100)
        service._ready_timeout_seconds = 1
        service._ready_poll_interval_seconds = 0

        service._ensure_wallet_synced(backend)

        self.assertEqual(client.session.post.call_count, 2)
        self.assertEqual(backend.ready_wallet, backend.current_wallet)
        client.raw_request.assert_called_once_with("refresh")

    def test_synced_wallet_is_not_refreshed(self):
        client = Mock()
        client.session.post.return_value.json.return_value = {
            "result": {"height": 100}
        }
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._daemon_height = Mock(return_value=100)

        service._ensure_wallet_synced(backend)

        client.raw_request.assert_not_called()

    def test_failed_refresh_falls_back_to_waiting(self):
        client = Mock()
        client.raw_request.side_effect = RequestException("timed out")
        client.session.post.return_value.json.side_effect = [
            {"result": {"height": 90}},
            {"result": {"height": 100}},
        ]
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._daemon_height = Mock(return_value=100)
        service._ready_timeout_seconds = 1
        service._ready_poll_interval_seconds = 0

        service._ensure_wallet_synced(backend)

        client.raw_request.assert_called_once_with("refresh")
        self.assertEqual(backend.ready_wallet, backend.current_wallet)

    def test_wallet_still_behind_after_refresh_times_out(self):
        client = Mock()
        client.session.post.return_value.json.return_value = {
            "result": {"height": 90}
        }
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._daemon_height = Mock(return_value=100)
        service._ready_timeout_seconds = 0
        service._ready_poll_interval_seconds = 0

        with self.assertRaises(HTTPException) as context:
            service._ensure_wallet_synced(backend)

        self.assertEqual(context.exception.status_code, 503)
        client.raw_request.assert_called_once_with("refresh")


class WalletDaemonSettingTests(unittest.TestCase):
    def _service(self, daemon_address="daemon:18081"):
        service = object.__new__(MoneroWalletService)
        service._daemon_address = daemon_address
        return service

    def _set_daemon_calls(self, client):
        return [
            call for call in client.raw_request.call_args_list
            if call.args[0] == "set_daemon"
        ]

    def test_daemon_is_set_once_per_open_wallet(self):
        client = Mock()
        backend = WalletBackend(
            client=client, url="http://wallet-rpc:18083", current_wallet="wallet-one"
        )
        service = self._service()

        service._ensure_daemon(backend)
        service._ensure_daemon(backend)

        self.assertEqual(len(self._set_daemon_calls(client)), 1)
        self.assertEqual(backend.daemon_wallet, "wallet-one")

    def test_daemon_is_set_again_after_another_wallet_is_opened(self):
        client = Mock()
        client.session.post.return_value.json.return_value = {
            "result": {"address": "other-address"}
        }
        backend = WalletBackend(
            client=client,
            url="http://wallet-rpc:18083",
            current_wallet="wallet-one",
            daemon_wallet="wallet-one",
        )
        service = self._service()

        service._ensure_wallet_open(
            backend=backend,
            wallet_name="wallet-two",
            payment_address="merchant-address",
            view_key="view-key",
        )
        service._ensure_daemon(backend)

        self.assertEqual(backend.current_wallet, "wallet-two")
        self.assertEqual(len(self._set_daemon_calls(client)), 1)
        self.assertEqual(backend.daemon_wallet, "wallet-two")

    def test_adopting_the_open_wallet_keeps_the_daemon_setting(self):
        client = Mock()
        client.session.post.return_value.json.return_value = {
            "result": {"address": "merchant-address"}
        }
        backend = WalletBackend(
            client=client,
            url="http://wallet-rpc:18083",
            current_wallet="wallet-one",
            daemon_wallet="wallet-one",
        )
        service = self._service()

        service._ensure_wallet_open(
            backend=backend,
            wallet_name="wallet-one",
            payment_address="merchant-address",
            view_key="view-key",
        )
        service._ensure_daemon(backend)

        client.raw_request.assert_not_called()

    def test_failed_daemon_setting_is_retried(self):
        client = Mock()
        client.raw_request.side_effect = [RequestException("busy"), {}]
        backend = WalletBackend(
            client=client, url="http://wallet-rpc:18083", current_wallet="wallet-one"
        )
        service = self._service()

        with self.assertRaises(HTTPException):
            service._ensure_daemon(backend)
        self.assertIsNone(backend.daemon_wallet)

        service._ensure_daemon(backend)

        self.assertEqual(len(self._set_daemon_calls(client)), 2)
        self.assertEqual(backend.daemon_wallet, "wallet-one")

    def test_no_daemon_configured_sends_nothing(self):
        client = Mock()
        backend = WalletBackend(
            client=client, url="http://wallet-rpc:18083", current_wallet="wallet-one"
        )

        self._service(daemon_address=None)._ensure_daemon(backend)

        client.raw_request.assert_not_called()


class OpenWalletOrderTests(unittest.TestCase):
    def _user(self, user_id):
        return SimpleNamespace(
            id=user_id,
            payment_address=f"address-{user_id}",
            view_key_encrypted="encrypted-view-key",
        )

    def test_wallet_is_open_matches_the_shard_current_wallet(self):
        backend = WalletBackend(client=Mock(), url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._backends = [backend]
        open_user, other_user = self._user("open"), self._user("other")

        with patch("app.monero_service.decrypt_secret", return_value="view-key"):
            backend.current_wallet = MoneroWalletService._wallet_name(
                open_user, open_user.payment_address, "view-key"
            )
            self.assertTrue(service.wallet_is_open(open_user))
            self.assertFalse(service.wallet_is_open(other_user))
        self.assertFalse(service.wallet_is_open(None))
        self.assertFalse(
            service.wallet_is_open(SimpleNamespace(
                id="no-key", payment_address="address", view_key_encrypted=None
            ))
        )

    def test_unreadable_view_key_does_not_stop_ordering(self):
        service = object.__new__(MoneroWalletService)
        service._backends = [WalletBackend(client=Mock(), url="http://wallet-rpc:18083")]

        with patch("app.monero_service.decrypt_secret", side_effect=ValueError("bad key")):
            self.assertFalse(service.wallet_is_open(self._user("broken")))

    def test_open_wallet_is_checked_first_and_others_keep_their_order(self):
        users = {user_id: self._user(user_id) for user_id in ("a", "b", "c", "d")}
        service = Mock()
        service.wallet_is_open.side_effect = lambda user: user.id == "c"

        self.assertEqual(reconciler._open_wallets_first(service, users), ["c", "a", "b", "d"])


if __name__ == "__main__":
    unittest.main()
