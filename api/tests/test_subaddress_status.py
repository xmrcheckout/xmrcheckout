"""Availability and HTTP creation tests use isolated schemas and mocked wallets."""
import json
import os
import random
import socket
import threading
import time
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import requests
import uvicorn
from fastapi import HTTPException
from monero.backends.jsonrpc.exceptions import RPCError
from sqlalchemy import event, text

from app import allocation_diagnostics as diagnostics, btcpay_routes, routes
from app import subaddress_status as status
from app.db import get_db
from app.main import app
from app.models import Invoice, SnapshotStatus, SubaddressAllocation, User
from app.security import hash_api_key
from app.wallet_rpc import WalletRPC
import test_subaddress_reuse as fixture


def _reference_availability(user, history, allocations, now):
    """The original quadratic loop, kept to check the faster version gives identical rows."""
    from app.subaddress_status import AddressAvailability, MAX_SUBADDRESS_INDEX, closure_time, reuse_ready_at, utc
    start = int(user.subaddress_start_index or 0)
    if start < 0 or start >= MAX_SUBADDRESS_INDEX:
        start = 0
    view_key = status.decrypt_secret(user.view_key_encrypted)
    result = []
    for index in range(start + 1, MAX_SUBADDRESS_INDEX + 1):
        address = status.derive_subaddress(payment_address=user.payment_address, view_key=view_key,
                                           account_index=0, address_index=index)
        previous = [row for row in history if row.address == address]
        issued = [row for row in allocations if row.address == address]
        row = AddressAvailability(index, "never_issued", "never_issued", address, previous)
        related = [item for item in history + allocations
                   if item.address == address or item.subaddress_index == index]
        prior_ids = {item.id for item in previous}
        generations = sorted(item.generation for item in issued)
        inconsistent = any(item.address != address or item.subaddress_index not in (None, index)
                           for item in related)
        inconsistent |= any(item.invoice_id not in prior_ids or item.subaddress_index != index
                            for item in issued)
        inconsistent |= bool(generations and generations != list(range(1, len(generations) + 1)))
        closed = [utc(closure_time(item)) for item in previous if closure_time(item) is not None]
        row.latest_closure_at = max(closed) if closed else None
        if inconsistent or (issued and not previous):
            row.category, row.code = "needs_review", "inconsistent_history"
        elif any(item.status not in ("pending", "partially_paid", "payment_detected", "confirmed", "expired", "invalid") for item in previous):
            row.category, row.code = "needs_review", "invalid_prior_invoice"
        elif any(item.status in ("confirmed", "expired", "invalid") and closure_time(item) is None
                 for item in previous):
            row.category, row.code = "needs_review", "missing_closure_time"
        elif any(item.status in ("pending", "partially_paid", "payment_detected") for item in previous):
            row.category = "reserved"
            row.code = ("awaiting_invoice_status_update" if any(
                item.status in ("pending", "partially_paid") and item.expires_at is not None and utc(item.expires_at) <= now
                for item in previous) else "active_invoice")
        elif previous:
            row.cooldown_complete_at = reuse_ready_at(previous)
            row.category = "eligible_for_reuse" if row.cooldown_complete_at <= now else "cooling_down"
            row.code = "cooldown_complete" if row.category == "eligible_for_reuse" else "reuse_cooldown"
        result.append(row)
    return result


class AvailabilityRulesTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.user = SimpleNamespace(subaddress_start_index=0, payment_address="fixture-address",
                                    view_key_encrypted="fixture-secret")
        self.patches = [patch.object(status, "decrypt_secret", return_value="fixture-view-key"),
                        patch.object(status, "derive_subaddress", side_effect=lambda **kw: f"address-{kw['address_index']}")]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def invoice(self, index, state="expired", **overrides):
        return SimpleNamespace(**(dict(id=uuid4(), address=f"address-{index}", subaddress_index=index,
            status=state, expires_at=self.now - timedelta(days=8), confirmed_at=None,
            archived_at=None) | overrides))

    def test_partition_and_conservative_explanations(self):
        invoices = [self.invoice(2), self.invoice(3, expires_at=self.now - timedelta(days=1)),
                    self.invoice(4, "pending"), self.invoice(5, "payment_detected"),
                    self.invoice(6, "invalid"), self.invoice(7, expires_at=None),
                    self.invoice(8, "confirmed", confirmed_at=None),
                    self.invoice(9, archived_at=self.now),
                    self.invoice(10, subaddress_index=11),
                    self.invoice(13, "invalid", expires_at=self.now - timedelta(hours=1)),
                    self.invoice(14, "invalid", expires_at=None)]
        orphan = SimpleNamespace(invoice_id=uuid4(), address="address-12", subaddress_index=12, generation=1)
        rows = status.availability(self.user, invoices, [orphan], self.now)
        self.assertEqual(len(rows), status.MAX_SUBADDRESS_INDEX)
        expected = {1: ("never_issued", "never_issued"), 2: ("eligible_for_reuse", "cooldown_complete"),
                    3: ("cooling_down", "reuse_cooldown"), 4: ("reserved", "awaiting_invoice_status_update"),
                    5: ("reserved", "active_invoice"), 6: ("eligible_for_reuse", "cooldown_complete"),
                    7: ("needs_review", "missing_closure_time"), 8: ("needs_review", "missing_closure_time"),
                    9: ("eligible_for_reuse", "cooldown_complete"),
                    10: ("needs_review", "inconsistent_history"), 11: ("needs_review", "inconsistent_history"),
                    12: ("needs_review", "inconsistent_history"), 13: ("cooling_down", "reuse_cooldown"),
                    14: ("needs_review", "missing_closure_time")}
        for index, values in expected.items():
            self.assertEqual((rows[index - 1].category, rows[index - 1].code), values)
        self.assertEqual(sum(sum(row.category == category for row in rows) for category in status.CATEGORIES), status.MAX_SUBADDRESS_INDEX)
        self.assertNotIn("fixture-secret", json.dumps([row.report() for row in rows], default=str))

    def test_latest_closure_boundary_and_legacy_history(self):
        older = self.invoice(1, subaddress_index=None)
        newer = self.invoice(1, "confirmed", confirmed_at=self.now - timedelta(seconds=status.SUBADDRESS_REUSE_COOLDOWN_SECONDS))
        row = status.availability(self.user, [older, newer], [], self.now)[0]
        self.assertEqual(row.category, "eligible_for_reuse")
        self.assertEqual(row.cooldown_complete_at, self.now)
        self.assertEqual(row.latest_closure_at, newer.confirmed_at)
        self.user.subaddress_start_index = status.MAX_SUBADDRESS_INDEX - 1
        self.assertEqual([row.index for row in status.availability(self.user, [], [], self.now)],
                         [status.MAX_SUBADDRESS_INDEX])

    def _random_history(self, seed, invoices=400, allocations=150):
        rng = random.Random(seed)
        statuses = ["pending", "partially_paid", "payment_detected", "confirmed", "expired", "invalid", "mystery"]
        history = []
        for _ in range(invoices):
            index = rng.randint(1, 205)
            overrides = {}
            if rng.random() < 0.1:
                overrides["subaddress_index"] = rng.choice([None, rng.randint(1, 205)])
            if rng.random() < 0.1:
                overrides["expires_at"] = None
            state = rng.choice(statuses)
            if state == "confirmed":
                overrides["confirmed_at"] = None if rng.random() < 0.1 else self.now - timedelta(hours=rng.randint(0, 200))
            else:
                overrides.setdefault("expires_at", self.now - timedelta(hours=rng.randint(-5, 200)))
            history.append(self.invoice(index, state, **overrides))
        allocs = []
        for _ in range(allocations):
            source = rng.choice(history) if rng.random() < 0.8 else None
            index = rng.randint(1, 205)
            allocs.append(SimpleNamespace(
                invoice_id=source.id if source else uuid4(),
                address=source.address if source and rng.random() < 0.9 else f"address-{index}",
                subaddress_index=(source.subaddress_index or index) if source else index,
                generation=rng.choice([1, 1, 1, 2, 3])))
        return history, allocs

    def test_matches_reference_on_random_histories(self):
        for seed in range(25):
            history, allocs = self._random_history(seed)
            expected = _reference_availability(self.user, history, allocs, self.now)
            actual = status.availability(self.user, history, allocs, self.now)
            summary = lambda rows: [(row.index, row.category, row.code, row.address, row.latest_closure_at,
                                     row.cooldown_complete_at, [item.id for item in row.previous]) for row in rows]
            self.assertEqual(summary(actual), summary(expected), f"seed {seed}")

    def test_large_history_is_fast(self):
        history = [self.invoice(1 + n % status.MAX_SUBADDRESS_INDEX) for n in range(50_000)]
        allocs = [SimpleNamespace(invoice_id=item.id, address=item.address, subaddress_index=item.subaddress_index,
                                  generation=1) for item in history[:status.MAX_SUBADDRESS_INDEX]]
        started = time.monotonic()
        status.availability(self.user, history, allocs, self.now)
        self.assertLess(time.monotonic() - started, 1.0)

    def test_failure_categories_never_include_rpc_messages(self):
        exc = RPCError({"code": -7, "message": "fixture-password fixture-view-key raw-payload"})
        exc.error = {"code": -7, "message": "fixture-password fixture-view-key raw-payload"}
        category, code = diagnostics.failure_category(exc)
        self.assertEqual((category, code), ("rpc_error", -7))
        self.assertEqual(diagnostics.failure_category(HTTPException(503, {"secret": "fixture-secret"})), ("snapshot_unavailable", None))

    def test_wallet_transport_does_not_log_raw_payloads_even_at_debug(self):
        client = WalletRPC(host="fixture", port=18083, user="fixture-user", password="fixture-password")
        with patch.object(client.session, "post") as post:
            post.return_value.status_code = 200
            post.return_value.json.return_value = {"error": {"code": -7, "message": "fixture-secret raw-RPC-response"}}
            with self.assertNoLogs(level="DEBUG"):
                with self.assertRaises(RPCError) as raised:
                    client.raw_request("generate_from_keys", {"viewkey": "fixture-view-key"})
            self.assertEqual(diagnostics.failure_category(raised.exception), ("rpc_error", -7))
            self.assertNotIn("fixture-secret", str(raised.exception.error))
            post.return_value.json.return_value = {"result": {"height": 100}}
            self.assertEqual(client.raw_request("get_height"), {"height": 100})


@unittest.skipUnless(os.getenv("SUBADDRESS_DATABASE_TESTS") == "1", "requires isolated PostgreSQL schema")
class StatusDatabaseTests(unittest.TestCase):
    setUp = fixture.AllocationDatabaseTests.setUp
    clean = fixture.AllocationDatabaseTests.clean
    issue = fixture.AllocationDatabaseTests.issue
    populate = fixture.AllocationDatabaseTests.populate

    def report(self):
        with self.Session() as db:
            return status.merchant_status(db, db.get(User, self.user_id))

    def test_reporting_matches_allocation_and_does_not_mutate_or_call_wallet(self):
        statements = []
        def capture(conn, cursor, statement, *args):
            statements.append(statement)
        event.listen(self.engine, "before_cursor_execute", capture)
        report = self.report()
        event.remove(self.engine, "before_cursor_execute", capture)
        self.assertTrue(all(statement.lstrip().upper().startswith("SELECT") for statement in statements))
        self.snapshot_mock.assert_not_called()
        self.assertEqual(report["counts"]["never_issued"], status.MAX_SUBADDRESS_INDEX)
        _, index = self.issue()
        self.assertEqual(index, 1)
        report = self.report()
        self.assertEqual(report["counts"]["reserved"], 1)
        self.assertIsNone(report["snapshot"])

    def test_allocator_and_report_agree_for_archived_and_review_cases(self):
        self.populate()
        with self.Session.begin() as db:
            rows = db.query(Invoice).order_by(Invoice.subaddress_index).all()
            rows[0].status = "invalid"  # Closed at expiry, so reusable after the cooldown.
            rows[0].expires_at += timedelta(hours=1)
            rows[1].expires_at = None
            rows[2].subaddress_index = 4
            rows[4].status = "pending"  # Past expiry still reserves its address.
            rows[5].expires_at = datetime.now(timezone.utc)
            rows[6].archived_at = datetime.now(timezone.utc)
            # Leave index 7 as the oldest eligible closure.
            for row in rows[7:]:
                row.expires_at += timedelta(hours=1)
        report = self.report()
        self.assertEqual(report["counts"]["needs_review"], 3)
        self.assertEqual(report["counts"]["reserved"], 1)
        self.assertEqual(report["counts"]["cooling_down"], 1)
        self.assertEqual(self.issue()[1], 7)

    def test_failure_survives_rollback_and_recovery_replaces_failure(self):
        self.populate()
        self.snapshot_mock.side_effect = RuntimeError("fixture-secret credential raw-RPC-response")
        with self.assertLogs("app.allocation_diagnostics", level="INFO") as logs:
            with self.assertRaises(diagnostics.AllocationError) as raised:
                self.issue()
        report = self.report()
        snapshot = report["snapshot"]
        self.assertEqual(str(snapshot["attempt_id"]), raised.exception.diagnostic_id)
        self.assertEqual(snapshot["outcome"], "failed")
        self.assertIsNone(snapshot["last_success_at"])
        self.assertNotIn("fixture-secret", " ".join(logs.output))
        self.assertNotIn("raw-RPC-response", json.dumps(report, default=str))
        with self.Session() as db:
            self.assertEqual(db.query(SubaddressAllocation).count(), 0)
            self.assertEqual(db.get(User, self.user_id).invoice_creation_count, 0)
        self.snapshot_mock.side_effect = None
        self.issue()
        recovered = self.report()["snapshot"]
        self.assertEqual(recovered["outcome"], "succeeded")
        self.assertIsNone(recovered["failure_category"])
        self.assertIsNotNone(recovered["last_success_at"])
        self.snapshot_mock.side_effect = RuntimeError("fixture-secret")
        with self.assertRaises(diagnostics.AllocationError):
            self.issue()
        failed = self.report()["snapshot"]
        self.assertEqual(failed["last_success_at"], recovered["last_success_at"])
        with self.Session() as db:
            self.assertEqual(db.query(SnapshotStatus).count(), 1)

    def test_diagnostic_storage_failure_preserves_both_creation_results(self):
        self.populate()
        with self.engine.begin() as conn:
            conn.execute(text("DROP TABLE snapshot_status"))
        with self.assertLogs("app.allocation_diagnostics", level="ERROR") as logs:
            self.assertEqual(self.issue()[1], 1)
            self.snapshot_mock.side_effect = RuntimeError("fixture-secret")
            with self.assertRaises(diagnostics.AllocationError) as raised:
                self.issue()
        self.assertEqual(raised.exception.code, "snapshot_failed")
        self.assertNotIn("fixture-secret", " ".join(logs.output))

    def start_http(self):
        def fixture_db():
            with self.Session() as db:
                yield db
        app.dependency_overrides[get_db] = fixture_db
        self.addCleanup(app.dependency_overrides.clear)
        # Lifespan disabled: never execute production initialization against fixtures.
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        server = uvicorn.Server(uvicorn.Config(app, lifespan="off", access_log=False, log_level="error"))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
        thread.start()
        def stop():
            server.should_exit = True
            thread.join(5)
            sock.close()
        self.addCleanup(stop)
        deadline = time.monotonic() + 5
        while not server.started:
            if time.monotonic() >= deadline:
                self.fail("Fixture HTTP server did not start")
            time.sleep(.01)
        return f"http://127.0.0.1:{sock.getsockname()[1]}"

    def fixture_auth(self):
        with self.Session.begin() as db:
            db.get(User, self.user_id).api_key_hash = hash_api_key("fixture-api-key")
        return {"Authorization": "ApiKey fixture-api-key"}

    def test_http_auth_isolation_no_store_and_public_health(self):
        headers = self.fixture_auth()
        other = uuid4()
        with self.Session.begin() as db:
            db.add(User(id=other, payment_address="other-merchant", view_key_encrypted="view",
                        api_key_hash=hash_api_key("other-fixture-key"), api_key_encrypted="key"))
        self.issue()
        base = self.start_http()
        path = base + "/api/core/subaddresses/status"
        self.assertEqual(requests.get(path, timeout=5).status_code, 401)
        self.assertEqual(requests.get(path, headers={"Authorization": "ApiKey wrong"}, timeout=5).status_code, 401)
        response = requests.get(path, headers=headers, timeout=5)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(response.json()["counts"]["reserved"], 1)
        other_response = requests.get(path, headers={"Authorization": "ApiKey other-fixture-key"}, timeout=5)
        self.assertEqual(other_response.json()["counts"]["never_issued"], status.MAX_SUBADDRESS_INDEX)
        self.assertNotIn("fixture-api-key", response.text)
        self.assertNotIn("fixture-view-key", response.text)
        health = requests.get(base + "/api/core/public/system/status", timeout=5)
        self.assertEqual(health.status_code, 200)
        self.assertNotIn("addresses", health.json())
        self.assertNotIn("snapshot", health.json())
        self.snapshot_mock.assert_not_called()

    def test_http_all_creation_routes_success_exhaustion_snapshot_failure_and_recovery(self):
        headers = self.fixture_auth()
        base = self.start_http()
        routes_to_test = [("/api/core/invoices", {"amount_xmr": "0.1"}, 201),
                          (f"/api/v1/stores/{self.user_id}/invoices", {"amount": "0.1", "currency": "XMR"}, 200),
                          ("/api/core/donations", {"amount_xmr": "0.1"}, 201)]
        patches = [patch.object(routes, "DONATIONS_ENABLED", True),
                   patch.object(routes, "_get_founder_user", side_effect=lambda db: db.get(User, self.user_id)),
                   patch.object(routes, "ensure_invoice_qr_png"), patch.object(btcpay_routes, "ensure_invoice_qr_png"),
                   patch.object(routes, "dispatch_webhooks"), patch.object(btcpay_routes, "dispatch_webhooks"),
                   patch.object(btcpay_routes, "dispatch_btcpay_webhooks")]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        for path, payload, success_status in routes_to_test:
            with self.subTest(path=path):
                with self.Session.begin() as db:
                    db.query(Invoice).delete()
                    db.query(SubaddressAllocation).delete()
                    db.get(User, self.user_id).invoice_creation_count = 0
                self.snapshot_mock.side_effect = None
                self.assertEqual(requests.post(base + path, json=payload, headers=headers, timeout=5).status_code, success_status)
                with self.Session.begin() as db:
                    db.query(Invoice).delete()
                    db.query(SubaddressAllocation).delete()
                self.populate(age=1)
                exhausted = requests.post(base + path, json=payload, headers=headers, timeout=5)
                self.assertEqual(exhausted.status_code, 429)
                self.assertIsInstance(exhausted.json()["detail"], str)
                self.assertIn("Retry-After", exhausted.headers)
                if "donations" not in path:
                    self.assertEqual(exhausted.json()["code"], "pool_exhausted")
                    self.assertGreater(exhausted.json()["retry_after_seconds"], 0)
                with self.Session.begin() as db:
                    for invoice in db.query(Invoice).all():
                        invoice.expires_at -= timedelta(days=8)
                self.snapshot_mock.side_effect = RuntimeError("fixture-secret raw RPC credentials")
                with self.assertLogs("app.allocation_diagnostics", level="INFO") as logs:
                    failed = requests.post(base + path, json=payload, headers=headers, timeout=5)
                self.assertEqual(failed.status_code, 503)
                reference = failed.json()["diagnostic_id"]
                UUID(reference)
                self.assertNotIn("fixture-secret", failed.text + " ".join(logs.output))
                with self.Session() as db:
                    self.assertEqual(str(db.get(SnapshotStatus, self.user_id).attempt_id), reference)
                if "donations" in path:
                    self.assertNotIn("code", failed.json())
                    self.assertNotIn("snapshot", failed.text)
                else:
                    self.assertEqual(failed.json()["code"], "snapshot_failed")
                self.snapshot_mock.side_effect = None
                recovered = requests.post(base + path, json=payload, headers=headers, timeout=5)
                self.assertEqual(recovered.status_code, success_status)
                self.assertEqual(self.report()["snapshot"]["outcome"], "succeeded")


if __name__ == "__main__":
    unittest.main()
