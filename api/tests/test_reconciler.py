import logging
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException
from requests import RequestException

from app import reconciler, routes
from app.models import Invoice, InvoiceTransfer, SystemStatus, User
from app.monero_service import MoneroWalletService, WalletBackend


class _FakeQuery:
    def __init__(self, model, invoices, user):
        self.model = model
        self.invoices = invoices
        self.user = user

    def filter(self, *_args, **_kwargs):
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        if self.model is Invoice:
            return self.invoices
        if self.model is InvoiceTransfer:
            return []
        return []

    def first(self):
        return self.user if self.model is User else None


class _FakeDb:
    def __init__(self, invoices, user):
        self.invoices = invoices
        self.user = user

    def query(self, model):
        return _FakeQuery(model, self.invoices, self.user)

    def add(self, _value):
        return None

    def delete(self, _value):
        return None

    def commit(self):
        return None

    def close(self):
        return None


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

        with patch.object(reconciler, "SessionLocal", return_value=db):
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

        with patch.object(reconciler, "SessionLocal", return_value=db):
            summary = reconciler._reconcile_invoices(service)

        self.assertEqual(summary.attempted, 2)
        self.assertEqual(summary.succeeded, 0)
        self.assertEqual(summary.failed, 2)
        service.ensure_wallet_ready.assert_called_once_with(user)
        service.get_transfers_for_address.assert_not_called()


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
    def test_new_wallet_generation_scans_from_height_zero(self):
        client = Mock()

        def raw_request(method, params=None):
            if method == "open_wallet":
                raise RequestException("cache missing")
            return {}

        client.raw_request.side_effect = raw_request
        backend = WalletBackend(client=client, url="http://wallet-rpc:18083")
        service = object.__new__(MoneroWalletService)
        service._wallet_dir = "/wallets"

        service._ensure_wallet_open(
            backend=backend,
            wallet_name="user-wallet",
            payment_address="merchant-address",
            view_key="view-key",
        )

        generate_call = next(
            call for call in client.raw_request.call_args_list if call.args[0] == "generate_from_keys"
        )
        self.assertEqual(generate_call.args[1]["restore_height"], 0)

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

        with self.assertRaises(HTTPException) as context:
            service._ensure_wallet_synced(backend)

        self.assertEqual(context.exception.status_code, 503)
        self.assertEqual(context.exception.detail, "View-only wallet is still syncing")

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


if __name__ == "__main__":
    unittest.main()
