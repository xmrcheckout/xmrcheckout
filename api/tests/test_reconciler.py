import logging
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException
from requests import RequestException

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
    def __init__(self, model, invoices, user, transfers):
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

    def query(self, model):
        return _FakeQuery(model, self.invoices, self.user, self.transfers)

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
    def test_last_successful_cycle_anchors_expired_invoice_cutoff(self):
        now = datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc)
        last_completed = now - timedelta(days=6)
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
            last_reconcile_completed_at=last_completed
        )

        with patch.object(reconciler, "LATE_PAYMENT_LOOKBACK_HOURS", 48):
            cutoff = reconciler._expired_invoice_cutoff(db, now=now)

        self.assertEqual(cutoff, last_completed - timedelta(hours=48))

    def test_missing_or_future_completion_uses_current_time(self):
        now = datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc)
        db = Mock()
        status = SimpleNamespace(last_reconcile_completed_at=now + timedelta(days=1))
        db.query.return_value.filter.return_value.first.return_value = status

        with patch.object(reconciler, "LATE_PAYMENT_LOOKBACK_HOURS", 48):
            future_cutoff = reconciler._expired_invoice_cutoff(db, now=now)
        status.last_reconcile_completed_at = None
        with patch.object(reconciler, "LATE_PAYMENT_LOOKBACK_HOURS", 48):
            missing_cutoff = reconciler._expired_invoice_cutoff(db, now=now)

        expected = now - timedelta(hours=48)
        self.assertEqual(future_cutoff, expected)
        self.assertEqual(missing_cutoff, expected)


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
        with self.assertRaises(HTTPException) as context:
            MoneroWalletService._validated_transfer_lists({"in": []})
        self.assertEqual(context.exception.status_code, 502)

    def test_wallet_rpc_lock_is_released_after_operation(self):
        connection = Mock()
        connection.execution_options.return_value = connection
        lock_result = Mock()
        lock_result.scalar.return_value = True
        connection.execute.side_effect = [lock_result, Mock()]
        engine = Mock()
        engine.connect.return_value = connection
        service = object.__new__(MoneroWalletService)
        service._lock_timeout_seconds = 1
        backend = WalletBackend(client=Mock(), url="http://wallet-rpc:18083")

        with patch.object(monero_service, "engine", engine):
            with service._wallet_rpc_lock(backend, operation="test"):
                pass

        self.assertEqual(connection.execute.call_count, 2)
        connection.close.assert_called_once_with()

    def test_wallet_rpc_lock_timeout_returns_service_unavailable(self):
        connection = Mock()
        connection.execution_options.return_value = connection
        lock_result = Mock()
        lock_result.scalar.return_value = False
        connection.execute.return_value = lock_result
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
        client = Mock()

        def raw_request(method, params=None):
            if method == "open_wallet":
                raise RequestException("cache missing")
            return {}

        client.raw_request.side_effect = raw_request
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._wallet_dir = "/wallets"
        service._daemon_height = Mock(return_value=2000)

        service._ensure_wallet_open(
            backend=backend,
            wallet_name="user-wallet",
            payment_address="merchant-address",
            view_key="view-key",
        )

        generate_call = next(
            call for call in client.raw_request.call_args_list if call.args[0] == "generate_from_keys"
        )
        self.assertEqual(generate_call.args[1]["restore_height"], 560)

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


if __name__ == "__main__":
    unittest.main()
