"""Isolated PostgreSQL/HTTP tests. Never run against a merchant database."""
import socket
import threading
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import requests
import uvicorn
from fastapi import FastAPI
from sqlalchemy.engine import make_url

from app import payment_links, reconciler, routes, terminals
from app.db import Base, SessionLocal, engine
from app.models import Invoice, InvoiceTransfer, User

REAL_FREE_ADDRESSES = terminals.free_addresses


@unittest.skipUnless(make_url(str(engine.url)).database == "payment_link_tests", "requires isolated payment_link_tests database")
class TerminalIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(engine)
        app = FastAPI()
        app.include_router(terminals.router)
        app.include_router(payment_links.router)
        app.include_router(routes.router)
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        cls.base = f"http://127.0.0.1:{sock.getsockname()[1]}"
        cls.server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
        cls.thread = threading.Thread(target=cls.server.run, kwargs={"sockets": [sock]}, daemon=True)
        cls.thread.start()
        for _ in range(100):
            if cls.server.started:
                break
            time.sleep(.05)
        assert cls.server.started

    @classmethod
    def tearDownClass(cls):
        cls.server.should_exit = True
        cls.thread.join(5)

    def setUp(self):
        from app.security import hash_api_key
        self.key = str(uuid4())
        with SessionLocal() as db:
            user = User(payment_address=str(uuid4()), view_key_encrypted="fixture", api_key_hash=hash_api_key(self.key), api_key_encrypted="fixture")
            db.add(user)
            db.commit()
            self.user_id = user.id
        self.headers = {"Authorization": f"ApiKey {self.key}"}
        self.patches = [
            patch.object(routes, "create_subaddress_for_user", side_effect=lambda db, user, invoice_id: (f"fixture-{invoice_id}", 1)),
            patch.object(routes, "ensure_invoice_qr_png"),
            patch.object(routes, "dispatch_webhooks"),
            patch.object(terminals, "free_addresses", return_value=150),
        ]
        for mock in self.patches:
            mock.start()
        self.addCleanup(lambda: [mock.stop() for mock in reversed(self.patches)])

    def create_terminal(self, **changes):
        response = requests.post(self.base + "/api/core/terminals", headers=self.headers,
                                 json={"name": "Front counter", **changes}, timeout=10)
        self.assertEqual(response.status_code, 201, response.text)
        data = response.json()
        secret = data["url"].split("#k=", 1)[1]
        return data, {"Authorization": f"Terminal {secret}"}

    def sell(self, auth, amount="0.05", currency="XMR", **headers):
        return requests.post(self.base + "/api/core/terminal/invoices", headers={**auth, **headers},
                             json={"amount": amount, "currency": currency, "note": "2 coffees"}, timeout=10)

    def test_sale_uses_terminal_settings(self):
        data, auth = self.create_terminal(confirmation_target=0, expiry_minutes=10)
        self.assertNotIn("token_hash", data)
        before = datetime.now(timezone.utc)
        response = self.sell(auth)
        self.assertEqual(response.status_code, 201, response.text)
        sale = response.json()
        self.assertEqual(sale["status"], "pending")
        self.assertEqual(sale["confirmation_target"], 0)
        self.assertEqual(sale["note"], "2 coffees")
        with SessionLocal() as db:
            invoice = db.get(Invoice, sale["id"])
            self.assertEqual(str(invoice.terminal_id), data["id"])
            self.assertEqual(invoice.metadata_json["origin"], "terminal")
            self.assertIsNone(invoice.payment_link_id)
            self.assertLess(invoice.expires_at, before + timedelta(minutes=11))

    def test_sales_do_not_use_public_payment_link_allowance(self):
        _, auth = self.create_terminal()
        for _ in range(payment_links.PUBLIC_PAYMENT_LINK_DAILY_LIMIT + 2):
            self.assertEqual(self.sell(auth).status_code, 201)

    def test_idempotent_retry_returns_same_invoice(self):
        _, auth = self.create_terminal()
        key = str(uuid4())
        first = self.sell(auth, **{"Idempotency-Key": key})
        replay = self.sell(auth, **{"Idempotency-Key": key})
        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(first.json()["id"], replay.json()["id"])

    def test_invalid_disabled_and_rotated_keys_are_rejected(self):
        self.assertEqual(self.sell({"Authorization": "Terminal wrong"}).status_code, 401)
        self.assertEqual(self.sell({"Authorization": f"ApiKey {self.key}"}).status_code, 401)
        data, auth = self.create_terminal()
        rotated = requests.post(self.base + f"/api/core/terminals/{data['id']}/rotate", headers=self.headers, timeout=10)
        self.assertEqual(rotated.status_code, 200)
        self.assertEqual(self.sell(auth).status_code, 401)
        new_auth = {"Authorization": f"Terminal {rotated.json()['url'].split('#k=', 1)[1]}"}
        self.assertEqual(self.sell(new_auth).status_code, 201)
        disabled = requests.patch(self.base + f"/api/core/terminals/{data['id']}", headers=self.headers,
                                  json={"name": "Front counter", "enabled": False}, timeout=10)
        self.assertEqual(disabled.status_code, 200)
        self.assertEqual(self.sell(new_auth).status_code, 403)

    def test_only_a_disabled_terminal_can_be_deleted(self):
        data, auth = self.create_terminal()
        sale = self.sell(auth).json()
        url = self.base + f"/api/core/terminals/{data['id']}"
        refused = requests.delete(url, headers=self.headers, timeout=10)
        self.assertEqual(refused.status_code, 409, refused.text)
        self.assertEqual(self.sell(auth).status_code, 201)
        disabled = requests.patch(url, headers=self.headers, json={"name": "Front counter", "enabled": False}, timeout=10)
        self.assertEqual(disabled.status_code, 200, disabled.text)
        deleted = requests.delete(url, headers=self.headers, timeout=10)
        self.assertEqual(deleted.status_code, 204, deleted.text)
        listed = requests.get(self.base + "/api/core/terminals", headers=self.headers, timeout=10).json()["terminals"]
        self.assertNotIn(data["id"], [terminal["id"] for terminal in listed])
        self.assertEqual(self.sell(auth).status_code, 401)
        self.assertEqual(requests.get(url + "/link", headers=self.headers, timeout=10).status_code, 404)
        self.assertEqual(requests.delete(url, headers=self.headers, timeout=10).status_code, 404)
        # The sale stays an invoice with its public status.
        public = requests.get(self.base + f"/api/core/public/invoice/{sale['id']}", timeout=10)
        self.assertEqual(public.status_code, 200, public.text)

    def test_merchant_cannot_delete_another_merchants_terminal(self):
        data, _ = self.create_terminal()
        requests.patch(self.base + f"/api/core/terminals/{data['id']}", headers=self.headers,
                       json={"name": "Front counter", "enabled": False}, timeout=10)
        from app.security import hash_api_key
        other_key = str(uuid4())
        with SessionLocal() as db:
            db.add(User(payment_address=str(uuid4()), view_key_encrypted="fixture", api_key_hash=hash_api_key(other_key), api_key_encrypted="fixture"))
            db.commit()
        other = requests.delete(self.base + f"/api/core/terminals/{data['id']}",
                                headers={"Authorization": f"ApiKey {other_key}"}, timeout=10)
        self.assertEqual(other.status_code, 404, other.text)
        listed = requests.get(self.base + "/api/core/terminals", headers=self.headers, timeout=10).json()["terminals"]
        self.assertIn(data["id"], [terminal["id"] for terminal in listed])

    def test_merchant_can_show_current_link_again(self):
        data, _ = self.create_terminal()
        link = self.base + f"/api/core/terminals/{data['id']}/link"
        shown = requests.get(link, headers=self.headers, timeout=10)
        self.assertEqual(shown.status_code, 200, shown.text)
        self.assertEqual(shown.json()["url"], data["url"])
        self.assertIn("no-store", shown.headers.get("Cache-Control", ""))
        rotated = requests.post(self.base + f"/api/core/terminals/{data['id']}/rotate", headers=self.headers, timeout=10).json()
        self.assertEqual(requests.get(link, headers=self.headers, timeout=10).json()["url"], rotated["url"])
        listed = requests.get(self.base + "/api/core/terminals", headers=self.headers, timeout=10).json()["terminals"]
        row = next(item for item in listed if item["id"] == data["id"])
        self.assertTrue(row["link_available"])
        self.assertNotIn("url", row)
        self.assertNotIn("token_encrypted", row)

    def test_link_is_not_shown_to_others_or_when_not_stored(self):
        from app.models import Terminal
        from app.security import hash_api_key
        data, auth = self.create_terminal()
        link = self.base + f"/api/core/terminals/{data['id']}/link"
        self.assertEqual(requests.get(link, headers=auth, timeout=10).status_code, 401)
        other_key = str(uuid4())
        with SessionLocal() as db:
            db.add(User(payment_address=str(uuid4()), view_key_encrypted="fixture", api_key_hash=hash_api_key(other_key), api_key_encrypted="fixture"))
            db.commit()
        self.assertEqual(requests.get(link, headers={"Authorization": f"ApiKey {other_key}"}, timeout=10).status_code, 404)
        with SessionLocal() as db:
            db.get(Terminal, UUID(data["id"])).token_encrypted = None
            db.commit()
        missing = requests.get(link, headers=self.headers, timeout=10)
        self.assertEqual(missing.status_code, 404)
        self.assertIn("Replace the link", missing.json()["detail"])

    def test_terminal_cannot_manage_terminals(self):
        _, auth = self.create_terminal()
        self.assertEqual(requests.get(self.base + "/api/core/terminals", headers=auth, timeout=10).status_code, 401)

    def test_terminal_reads_and_cancels_only_its_own_invoices(self):
        _, auth = self.create_terminal()
        _, other = self.create_terminal(name="Market stall")
        sale = self.sell(auth).json()
        url = self.base + f"/api/core/terminal/invoices/{sale['id']}"
        self.assertEqual(requests.get(url, headers=other, timeout=10).status_code, 404)
        self.assertEqual(requests.post(url + "/cancel", headers=other, timeout=10).status_code, 404)
        self.assertEqual(requests.get(url, headers=auth, timeout=10).status_code, 200)
        cancelled = requests.post(url + "/cancel", headers=auth, timeout=10)
        self.assertEqual(cancelled.status_code, 200, cancelled.text)
        with SessionLocal() as db:
            self.assertLessEqual(db.get(Invoice, sale["id"]).expires_at, datetime.now(timezone.utc))

    def test_cancel_refused_after_payment_seen(self):
        _, auth = self.create_terminal()
        sale = self.sell(auth).json()
        with SessionLocal() as db:
            db.add(InvoiceTransfer(invoice_id=sale["id"], txid=uuid4().hex, amount_atomic=1, confirmations=0))
            db.commit()
        response = requests.post(self.base + f"/api/core/terminal/invoices/{sale['id']}/cancel", headers=auth, timeout=10)
        self.assertEqual(response.status_code, 409)

    def test_status_reports_settings_and_capacity(self):
        _, auth = self.create_terminal(default_currency="EUR")
        status = requests.get(self.base + "/api/core/terminal/status", headers=auth, timeout=10).json()
        self.assertEqual(status["name"], "Front counter")
        self.assertEqual(status["default_currency"], "EUR")
        self.assertEqual(status["available_addresses"], 150)
        self.assertFalse(status["low_addresses"])
        self.assertNotIn("url", status)

    def test_status_survives_unavailable_capacity_and_is_not_cached(self):
        _, auth = self.create_terminal()
        with patch.object(terminals, "free_addresses", REAL_FREE_ADDRESSES), \
                patch.object(terminals, "merchant_status", side_effect=RuntimeError("derivation failed")):
            response = requests.get(self.base + "/api/core/terminal/status", headers=auth, timeout=10)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["available_addresses"])
        self.assertFalse(response.json()["low_addresses"])
        self.assertEqual(response.headers.get("cache-control"), "no-store")

    def test_quick_check_opens_wallets_only_for_terminal_merchants(self):
        _, auth = self.create_terminal()
        sale = self.sell(auth).json()
        with SessionLocal() as db:
            plain = Invoice(user_id=self.user_id, address="plain", amount_xmr=1, status="pending", confirmation_target=1)
            db.add(plain)
            db.commit()
            plain_id = str(plain.id)
        service = MagicMock()
        # Closed wallets: only a terminal sale may open one.
        service.wallet_is_open.return_value = False
        checked = []
        with patch.object(reconciler, "_reconcile_invoice", side_effect=lambda db, svc, user, inv: checked.append(str(inv.id)) or True), \
                patch.object(reconciler, "SessionLocal", SessionLocal):
            reconciler._reconcile_invoices(service, quick=True)
        self.assertIn(sale["id"], checked)
        # The wallet is opened for the sale, so the merchant's other open invoices are checked too.
        self.assertIn(plain_id, checked)
        with SessionLocal() as db:
            terminal_users = {row.user_id for row in db.query(Invoice).filter(Invoice.terminal_id.is_not(None)).all()}
            checked_users = {row.user_id for row in db.query(Invoice).filter(Invoice.id.in_([UUID(i) for i in checked])).all()}
        self.assertTrue(checked_users <= terminal_users)
        service.refresh_wallet.assert_called()
        service.ensure_wallet_ready.assert_not_called()


class TerminalInputTests(unittest.TestCase):
    def test_sale_amount_validation(self):
        from fastapi import HTTPException
        ok = terminals.parse_sale_amount(terminals.TerminalSale(amount="4.50", currency="eur"))
        self.assertEqual((str(ok[0]), ok[1]), ("4.50", "EUR"))
        for amount, currency in (("0", "XMR"), ("1.234", "EUR"), ("-1", "XMR"), ("1e3", "XMR"), ("1", "BTC")):
            with self.assertRaises(HTTPException):
                terminals.parse_sale_amount(terminals.TerminalSale(amount=amount, currency=currency))

    def test_url_keeps_secret_in_fragment(self):
        self.assertRegex(terminals.terminal_url("xmrterm_abc"), r"/terminal#k=xmrterm_abc$")
