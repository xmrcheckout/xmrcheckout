"""Set SUBADDRESS_DATABASE_TESTS=1 to exercise isolated PostgreSQL schemas."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app import reconciler, subaddress_allocator as allocator
from app.config import DATABASE_URL
from app.db import Base
from app.invoice_limits import reserve_invoice_creation
from app.models import Invoice, InvoiceTransfer, SubaddressAllocation, User
from app.monero_service import MoneroWalletService, TransferDetail


class TransferIsolationTests(unittest.TestCase):
    def setUp(self):
        self.allocation = SimpleNamespace(invoice_id=uuid4(), cutoff_height=100,
                                          excluded_txids=["old", "old-pool"])

    def eligible(self, *transfers):
        return reconciler.eligible_allocation_transfers(self.allocation, list(transfers))

    def test_history_and_snapshot_pool_never_count_even_after_reorg(self):
        self.assertEqual(self.eligible(
            TransferDetail("old", 10, 1, None, "a", 200),
            TransferDetail("old-pool", 10, 2, None, "a", 201),
            TransferDetail("unseen-history", 10, 5, None, "a", 99)), [])

    def test_new_pending_then_confirmed_payment_remains_eligible(self):
        for confirmations, height in [(0, 0), (1, 101), (10, 101)]:
            transfer = TransferDetail("new", 10, confirmations, None, "a", height)
            self.assertEqual(self.eligible(transfer), [transfer])

    def test_missing_or_invalid_confirmed_height_is_held(self):
        for height in [None, 0, -1]:
            self.assertEqual(self.eligible(TransferDetail("unknown", 10, 2, None, "a", height)), [])

    def test_first_use_and_legacy_accounting_are_unchanged(self):
        transfers = [TransferDetail("new", 10, 1, None, "a")]
        self.assertEqual(reconciler.eligible_allocation_transfers(None, transfers), transfers)
        self.allocation.cutoff_height = None
        self.assertEqual(reconciler.eligible_allocation_transfers(self.allocation, transfers), transfers)

    def test_snapshot_refreshes_and_checks_scan_coverage(self):
        service = object.__new__(MoneroWalletService)
        backend = SimpleNamespace(client=Mock(), ready_wallet="cached")
        service._wallet_name = Mock(return_value="wallet")
        service._backend_for_wallet_name = Mock(return_value=backend)
        service._wallet_rpc_lock = Mock(return_value=nullcontext())
        service._ensure_wallet_ready_locked = Mock()
        service._daemon_height = Mock(return_value=101)
        service._get_transfers_for_address_locked = Mock(return_value=[])
        backend.client.raw_request.side_effect = [{}, {"height": 101}]
        with patch("app.monero_service.decrypt_secret", return_value="view"):
            self.assertEqual(service.snapshot_address(SimpleNamespace(
                payment_address="a", view_key_encrypted="encrypted"), "a"), (100, []))
        backend.client.raw_request.assert_any_call("refresh")
        self.assertIsNone(backend.ready_wallet)

    def test_incomplete_snapshot_is_rejected(self):
        service = object.__new__(MoneroWalletService)
        service._get_address_index = Mock(return_value=(0, 1))
        backend = SimpleNamespace(client=Mock())
        backend.client.raw_request.return_value = {
            "in": [{"txid": "old", "amount": 10, "confirmations": 2}],
        }
        with self.assertRaises(HTTPException):
            service._get_transfers_for_address_locked(backend, "a", strict=True)

    def test_cooldown_uses_latest_closure_and_blocks_active_or_unknown(self):
        now = datetime.now(timezone.utc)
        closed = SimpleNamespace(status="confirmed", confirmed_at=now, expires_at=None)
        self.assertEqual(allocator.reuse_ready_at([closed]), now + timedelta(days=7))
        for status in ["pending", "payment_detected", "invalid"]:
            self.assertIsNone(allocator.reuse_ready_at([closed, SimpleNamespace(status=status)]))
        expired = SimpleNamespace(status="expired", expires_at=now + timedelta(days=1))
        self.assertEqual(allocator.reuse_ready_at([closed, expired]), now + timedelta(days=8))
        self.assertIsNone(allocator.reuse_ready_at([SimpleNamespace(status="confirmed", confirmed_at=None)]))


@unittest.skipUnless(os.getenv("SUBADDRESS_DATABASE_TESTS") == "1", "requires isolated PostgreSQL schema")
class AllocationDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.schema = "test_reuse_" + uuid4().hex
        self.admin = create_engine(DATABASE_URL)
        with self.admin.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.engine = create_engine(DATABASE_URL, connect_args={"options": f"-csearch_path={self.schema}"})
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.user_id = uuid4()
        with self.Session.begin() as db:
            db.add(User(id=self.user_id, payment_address="merchant", view_key_encrypted="view",
                        api_key_hash="hash", api_key_encrypted="key"))
        self.decrypt = patch.object(allocator, "decrypt_secret", return_value="view")
        self.derive = patch.object(allocator, "derive_subaddress", side_effect=lambda **kw: f"address-{kw['address_index']}")
        self.snapshot = patch.object(MoneroWalletService, "snapshot_address", return_value=(100, [
            TransferDetail("historical", 100, 10, None, "address-1", 90)]))
        self.decrypt.start()
        self.derive.start()
        self.snapshot_mock = self.snapshot.start()
        self.service_init = patch.object(MoneroWalletService, "__init__", return_value=None)
        self.service_init.start()
        self.addCleanup(self.clean)

    def clean(self):
        self.service_init.stop()
        self.snapshot.stop()
        self.derive.stop()
        self.decrypt.stop()
        self.engine.dispose()
        with self.admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))
        self.admin.dispose()

    def issue(self):
        with self.Session.begin() as db:
            user = db.get(User, self.user_id)
            user = reserve_invoice_creation(db, user=user)
            invoice_id = uuid4()
            address, index = allocator.create_subaddress_for_user(db, user=user, invoice_id=invoice_id)
            db.add(Invoice(id=invoice_id, user_id=user.id, address=address, subaddress_index=index,
                           amount_xmr=Decimal("0.0000000001"), status="pending", confirmation_target=1,
                           expires_at=datetime.now(timezone.utc) + timedelta(hours=1)))
            return invoice_id, index

    def populate(self, age=8):
        with self.Session.begin() as db:
            for index in range(1, 101):
                db.add(Invoice(id=uuid4(), user_id=self.user_id, address=f"address-{index}",
                    subaddress_index=index, amount_xmr=Decimal("1"), status="expired", confirmation_target=1,
                    expires_at=datetime.now(timezone.utc) - timedelta(days=age)))

    def test_first_hundred_never_reuse_and_next_is_blocked(self):
        # Raise only the rate quota in this fixture; real active limits remain intact.
        with patch("app.invoice_limits.INVOICE_CREATION_RATE_LIMIT", 1000):
            self.assertEqual([self.issue()[1] for _ in range(100)], list(range(1, 101)))
        self.snapshot_mock.assert_not_called()
        with self.assertRaises(HTTPException) as raised:
            self.issue()
        self.assertEqual(raised.exception.status_code, 429)

    def test_cooldown_returns_retry_and_snapshot_failure_rolls_back(self):
        self.populate(age=1)
        with self.assertRaises(HTTPException) as raised:
            self.issue()
        self.assertEqual(raised.exception.status_code, 429)
        self.assertGreater(int(raised.exception.headers["Retry-After"]), 0)
        with self.Session.begin() as db:
            for row in db.query(Invoice).all():
                row.expires_at -= timedelta(days=8)
        self.snapshot_mock.side_effect = RuntimeError("offline")
        with self.assertRaises(HTTPException) as raised:
            self.issue()
        self.assertEqual(raised.exception.status_code, 503)
        with self.Session() as db:
            self.assertEqual(db.query(SubaddressAllocation).count(), 0)
            self.assertEqual(db.get(User, self.user_id).invoice_creation_count, 0)

    def test_concurrent_reuse_is_distinct_and_snapshot_is_persisted(self):
        self.populate()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.issue(), range(2)))
        self.assertEqual({index for _, index in results}, {1, 2})
        with self.Session() as db:
            rows = db.query(SubaddressAllocation).all()
            self.assertEqual(len(rows), 2)
            self.assertTrue(all(row.cutoff_height == 100 and "historical" in row.excluded_txids for row in rows))
            self.assertEqual(db.query(Invoice).filter(Invoice.status == "expired").count(), 100)

    def test_reconciliation_lock_blocks_allocation_without_consuming_quota(self):
        # The reconciler uses this same session-level lock across invoice commits.
        with self.engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            key = reconciler._invoice_lock_key(f"allocation:{self.user_id}")
            conn.execute(text("SELECT pg_advisory_lock(:key)"), {"key": key})
            try:
                with self.assertRaises(HTTPException) as raised:
                    self.issue()
                self.assertEqual(raised.exception.status_code, 503)
            finally:
                conn.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})
        with self.Session() as db:
            self.assertEqual(db.query(SubaddressAllocation).count(), 0)
            self.assertEqual(db.get(User, self.user_id).invoice_creation_count, 0)

    def test_reconciliation_credits_only_new_payment_and_freezes_old_invoice(self):
        self.populate()
        invoice_id, _ = self.issue()
        with self.Session() as db:
            user = db.get(User, self.user_id)
            invoice = db.get(Invoice, invoice_id)
            service = Mock()
            service.get_transfers_for_address.return_value = [
                TransferDetail("historical", 100, 20, None, invoice.address, 90),
                TransferDetail("fresh", 40, 2, None, invoice.address, 101)]
            with patch.object(reconciler, "dispatch_webhooks") as hooks, patch.object(reconciler, "dispatch_btcpay_webhooks"):
                reconciler._reconcile_invoice(db, service, user, invoice)
                self.assertEqual(invoice.total_paid_atomic, 40)
                self.assertEqual(invoice.status, "pending")
                hooks.assert_not_called()
                service.get_transfers_for_address.return_value.append(
                    TransferDetail("top-up", 60, 2, None, invoice.address, 102))
                reconciler._reconcile_invoice(db, service, user, invoice)
                self.assertEqual(invoice.status, "confirmed")
                self.assertEqual(hooks.call_count, 2)
                reconciler._reconcile_invoice(db, service, user, invoice)
                self.assertEqual(hooks.call_count, 2)
                old = db.query(Invoice).filter(Invoice.address == invoice.address, Invoice.id != invoice.id).first()
                service.reset_mock()
                reconciler._reconcile_invoice(db, service, user, old)
                service.get_transfers_for_address.assert_not_called()
                self.assertEqual(old.status, "expired")
            self.assertEqual({row.txid for row in db.query(InvoiceTransfer).all()}, {"fresh", "top-up"})

class AdditionalIsolationTests(unittest.TestCase):
    def test_newly_discovered_history_stays_excluded_after_reorg(self):
        allocation = SimpleNamespace(invoice_id=uuid4(), cutoff_height=100, excluded_txids=[])
        old = TransferDetail("rediscovered", 10, 5, None, "a", 90)
        self.assertEqual(reconciler.eligible_allocation_transfers(allocation, [old]), [])
        reorganized = TransferDetail("rediscovered", 10, 1, None, "a", 105)
        self.assertEqual(reconciler.eligible_allocation_transfers(allocation, [reorganized]), [])
