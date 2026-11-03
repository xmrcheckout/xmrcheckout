"""Isolated PostgreSQL/HTTP tests. Never run against a merchant database."""
import os
import socket
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import requests
import uvicorn
from fastapi import FastAPI
from sqlalchemy.engine import make_url

from app import payment_links, routes
from app.db import Base, SessionLocal, engine
from app.models import Invoice, PaymentLink, User
from app.security import hash_api_key


@unittest.skipUnless(make_url(str(engine.url)).database == "payment_link_tests", "requires isolated payment_link_tests database")
class PaymentLinkIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(engine)
        app = FastAPI()
        @app.get("/__test/ping")
        async def ping():
            return {"ok": True}

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
        self.key = str(uuid4())
        with SessionLocal() as db:
            user = User(payment_address=str(uuid4()), view_key_encrypted="fixture", api_key_hash=hash_api_key(self.key), api_key_encrypted="fixture")
            db.add(user)
            db.commit()
            self.user_id = user.id
        self.headers = {"Authorization": f"ApiKey {self.key}"}
        self.settings = {"title": "Example product", "description": "Download arranged by merchant", "amount_xmr": "0.1", "confirmation_target": 2}
        self.patches = [patch.object(routes, "create_subaddress_for_user", return_value=("fixture-address", 1)), patch.object(routes, "ensure_invoice_qr_png"), patch.object(routes, "dispatch_webhooks")]
        for mock in self.patches:
            mock.start()
        self.addCleanup(lambda: [mock.stop() for mock in reversed(self.patches)])

    def create(self, **changes):
        response = requests.post(self.base + "/api/core/payment-links", headers=self.headers, json={**self.settings, **changes}, timeout=10)
        self.assertEqual(response.status_code, 201, response.text)
        data = response.json()
        token = data["url"].rsplit("/", 1)[1]
        return data, self.base + f"/api/core/public/payment-links/{token}"

    def test_attempt_recovers_despite_forged_origin_headers(self):
        import os
        _, url = self.create()
        headers = {"Accept": "application/json", "Idempotency-Key": str(uuid4())}
        with patch.dict(os.environ, {"SITE_URL": self.base}):
            first = requests.post(url + "/invoices", headers={**headers, "Host": "attacker.example", "X-Forwarded-Proto": "http"}, timeout=10)
            self.assertEqual(first.status_code, 201, first.text)
            replay = requests.post(url + "/invoices", headers={**headers, "X-Forwarded-Host": "evil.example"}, timeout=10)
            self.assertEqual(replay.status_code, 200, replay.text)
            self.assertTrue(first.json()["invoice_url"].startswith(self.base + "/invoice/"))
            self.assertTrue(replay.json()["invoice_url"].startswith(self.base + "/invoice/"))
            self.assertEqual(first.json()["invoice_url"].rsplit("/", 1)[1], replay.json()["invoice_url"].rsplit("/", 1)[1])

    def test_existing_database_upgrade(self):
        from sqlalchemy import create_engine, text
        from app import main
        schema = "payment_link_migration_" + uuid4().hex
        with engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        isolated = create_engine(engine.url, connect_args={"options": f"-csearch_path={schema}"})
        try:
            Base.metadata.create_all(isolated)
            with isolated.begin() as connection:
                connection.execute(text("ALTER TABLE payment_links DROP COLUMN auto_create_invoice"))
                connection.execute(text("ALTER TABLE payment_links DROP COLUMN button_text"))
                connection.execute(text("ALTER TABLE payment_links DROP COLUMN confirmation_message"))
                connection.execute(text("ALTER TABLE payment_links DROP COLUMN customer_amount"))
                connection.execute(text("ALTER TABLE payment_links DROP COLUMN minimum_amount_xmr"))
                connection.execute(text("ALTER TABLE invoices DROP COLUMN payment_link_id CASCADE"))
                connection.execute(text("ALTER TABLE invoices DROP COLUMN payment_link_attempt_id"))
                connection.execute(text("INSERT INTO payment_links (id,user_id,token,title,description,confirmation_target,enabled) VALUES (:id,:user,'legacy','Legacy','',2,true)"), {"id": uuid4(), "user": uuid4()})
            with patch.object(main, "engine", isolated):
                main.startup()
                main.startup()
            with isolated.connect() as connection:
                self.assertEqual(connection.execute(text("SELECT button_text FROM payment_links WHERE token='legacy'")).scalar_one(), "Buy with Monero")
                self.assertFalse(connection.execute(text("SELECT auto_create_invoice FROM payment_links WHERE token='legacy'")).scalar_one())
                self.assertIsNone(connection.execute(text("SELECT confirmation_message FROM payment_links WHERE token='legacy'")).scalar_one())
                self.assertFalse(connection.execute(text("SELECT customer_amount FROM payment_links WHERE token='legacy'")).scalar_one())
                self.assertIsNone(connection.execute(text("SELECT minimum_amount_xmr FROM payment_links WHERE token='legacy'")).scalar_one())
                connection.execute(text("SELECT payment_link_id,payment_link_attempt_id FROM invoices"))
                self.assertIsNotNone(connection.execute(text("SELECT indexname FROM pg_indexes WHERE schemaname=:schema AND indexname='invoice_payment_link_attempt'"), {"schema": schema}).scalar_one())
        finally:
            isolated.dispose()
            with engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))

    def test_custom_button_text(self):
        data, url = self.create(button_text="Donate & <Monero>")
        self.assertEqual(data["button_text"], "Donate & <Monero>")
        endpoint = self.base + "/api/core/payment-links/" + data["id"]
        disabled = requests.patch(endpoint, headers=self.headers, json={"enabled": False})
        self.assertEqual(disabled.json()["button_text"], "Donate & <Monero>")
        for value in ("", "   ", "x" * 33, "bad\x00text"):
            response = requests.patch(endpoint, headers=self.headers, json={**self.settings, "button_text": value})
            self.assertEqual(response.status_code, 422, response.text)
        updated = requests.patch(endpoint, headers=self.headers, json={**self.settings, "button_text": "Subscribe with Monero"})
        self.assertEqual(updated.json()["button_text"], "Subscribe with Monero")
        default, _ = self.create()
        self.assertEqual(default["button_text"], "Buy with Monero")

    def test_automatic_setting_and_idempotent_creation(self):
        data, url = self.create(auto_create_invoice=True)
        self.assertTrue(data["auto_create_invoice"])
        self.assertTrue(requests.get(url).json()["auto_create_invoice"])
        self.assertEqual(requests.head(url + "/invoices").status_code, 405)
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter(Invoice.user_id == self.user_id).count(), 0)
        headers = {"Accept": "application/json", "Idempotency-Key": str(uuid4())}
        with patch.object(payment_links, "PUBLIC_PAYMENT_LINK_DAILY_LIMIT", 1):
            first = requests.post(url + "/invoices", headers=headers)
            second = requests.post(url + "/invoices", headers=headers)
            self.assertEqual(first.status_code, 201, first.text)
            self.assertEqual(second.status_code, 200, second.text)
            self.assertEqual(first.json(), second.json())
            self.assertEqual(requests.post(url + "/invoices", headers={**headers, "Idempotency-Key": str(uuid4())}).status_code, 429)
        patch_url = self.base + "/api/core/payment-links/" + data["id"]
        requests.patch(patch_url, headers=self.headers, json={"enabled": False}).raise_for_status()
        self.assertEqual(requests.post(url + "/invoices", headers=headers).status_code, 404)
        response = requests.patch(patch_url, headers=self.headers, json={"enabled": True})
        self.assertTrue(response.json()["auto_create_invoice"])
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter(Invoice.user_id == self.user_id).count(), 1)
        self.assertEqual(requests.post(url + "/invoices", headers={**headers, "Idempotency-Key": "bad"}).status_code, 400)

    def test_concurrent_attempt_and_link_scope(self):
        _, url = self.create()
        headers = {"Accept": "application/json", "Idempotency-Key": str(uuid4())}
        with ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(lambda _: requests.post(url + "/invoices", headers=headers), range(4)))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 200, 200, 201])
        self.assertEqual(len({r.json()["invoice_url"] for r in responses}), 1)
        self.assertEqual(routes.create_subaddress_for_user.call_count, 1)
        self.assertEqual(routes.dispatch_webhooks.call_count, 1)
        _, other = self.create()
        self.assertNotEqual(requests.post(other + "/invoices", headers=headers).json()["invoice_url"], responses[0].json()["invoice_url"])

    def test_recovery_after_commit(self):
        _, url = self.create()
        headers = {"Accept": "application/json", "Idempotency-Key": str(uuid4())}
        with patch.object(routes, "dispatch_webhooks", side_effect=RuntimeError("post-commit failure")):
            self.assertEqual(requests.post(url + "/invoices", headers=headers).status_code, 503)
        replay = requests.post(url + "/invoices", headers=headers)
        self.assertEqual(replay.status_code, 200, replay.text)
        with SessionLocal() as db:
            invoice = db.query(Invoice).filter(Invoice.user_id == self.user_id).one()
            invoice.status = "confirmed"
            db.commit()
        self.assertEqual(requests.post(url + "/invoices", headers=headers).json()["status"], "confirmed")

    def test_management_and_public_boundary(self):
        data, url = self.create()
        self.assertEqual(requests.get(self.base + "/api/core/payment-links").status_code, 401)
        self.assertEqual(requests.patch(self.base + "/api/core/payment-links/" + data["id"], headers={"Authorization": "ApiKey wrong"}, json=self.settings).status_code, 401)
        other_key = str(uuid4())
        with SessionLocal() as db:
            other = User(payment_address=str(uuid4()), view_key_encrypted="fixture", api_key_hash=hash_api_key(other_key), api_key_encrypted="fixture")
            db.add(other)
            db.commit()
        self.assertEqual(requests.patch(self.base + "/api/core/payment-links/" + data["id"], headers={"Authorization": f"ApiKey {other_key}"}, json=self.settings).status_code, 404)
        public = requests.get(url).json()
        self.assertNotIn("id", public)
        self.assertNotIn("checkout_continue_url", public)
        self.assertEqual(requests.get(url + "/invoices").status_code, 405)
        self.assertEqual(requests.head(url + "/invoices").status_code, 405)
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter(Invoice.user_id == self.user_id).count(), 0)

    def test_creation_snapshots_and_disable(self):
        data, url = self.create()
        first = requests.post(url + "/invoices", headers={"Origin": "https://independent.example"}, allow_redirects=False)
        second = requests.post(url + "/invoices", allow_redirects=False)
        self.assertEqual(first.status_code, 303, first.text)
        self.assertEqual(second.status_code, 303, second.text)
        self.assertNotEqual(first.headers["Location"], second.headers["Location"])
        requests.patch(self.base + "/api/core/payment-links/" + data["id"], headers=self.headers, json={**self.settings, "title": "Changed", "enabled": False}).raise_for_status()
        self.assertEqual(requests.get(url).status_code, 404)
        self.assertEqual(requests.post(url + "/invoices").status_code, 404)
        with SessionLocal() as db:
            invoices = db.query(Invoice).filter(Invoice.user_id == self.user_id).all()
            self.assertEqual(len(invoices), 2)
            self.assertTrue(all(i.metadata_json["payment_link"]["title"] == "Example product" for i in invoices))
        requests.patch(self.base + "/api/core/payment-links/" + data["id"], headers=self.headers, json=self.settings).raise_for_status()
        self.assertEqual(requests.get(url).status_code, 200)

    def test_confirmed_return_url(self):
        _, url = self.create(checkout_continue_url="https://merchant.example/thanks")
        response = requests.post(url + "/invoices", allow_redirects=False)
        invoice_id = response.headers["Location"].rsplit("/", 1)[1]
        endpoint = self.base + f"/api/core/public/invoice/{invoice_id}/continue"
        self.assertEqual(requests.get(endpoint, allow_redirects=False).status_code, 404)
        with SessionLocal() as db:
            db.query(Invoice).filter(Invoice.id == invoice_id).update({"status": "confirmed"})
            db.commit()
        returned = requests.get(endpoint, allow_redirects=False)
        self.assertEqual(returned.status_code, 302)
        self.assertEqual(returned.headers["Location"], "https://merchant.example/thanks")

    def test_confirmation_message_validation(self):
        data, _ = self.create(confirmation_message="  Download: https://merchant.example/a.pdf\r\nThanks\t!  ")
        self.assertEqual(data["confirmation_message"], "Download: https://merchant.example/a.pdf\nThanks\t!")
        endpoint = self.base + "/api/core/payment-links/" + data["id"]
        for value in ("x" * 2001, "bad\x00text", "bell\x07", "c1\x85text"):
            response = requests.patch(endpoint, headers=self.headers, json={**self.settings, "confirmation_message": value})
            self.assertEqual(response.status_code, 422, value)
        self.assertEqual(requests.patch(endpoint, headers=self.headers, json={**self.settings, "confirmation_message": "x" * 2000}).json()["confirmation_message"], "x" * 2000)
        for value in ("   ", "", None):
            cleared = requests.patch(endpoint, headers=self.headers, json={**self.settings, "confirmation_message": value})
            self.assertIsNone(cleared.json()["confirmation_message"])
        default, _ = self.create()
        self.assertIsNone(default["confirmation_message"])

    def test_confirmation_message_only_after_confirmation(self):
        message = "Your ebook: https://merchant.example/book-1.pdf"
        data, url = self.create(confirmation_message=message, checkout_continue_url="https://merchant.example/thanks")
        self.assertNotIn("confirmation_message", requests.get(url).json())
        self.assertNotIn("book-1", requests.get(url).text)
        invoice_id = requests.post(url + "/invoices", allow_redirects=False).headers["Location"].rsplit("/", 1)[1]
        status_url = self.base + f"/api/core/public/invoice/{invoice_id}"
        for state in ("pending", "payment_detected", "expired", "invalid"):
            with SessionLocal() as db:
                db.query(Invoice).filter(Invoice.id == invoice_id).update({"status": state})
                db.commit()
            response = requests.get(status_url)
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertIsNone(response.json()["confirmation_message"], state)
            self.assertNotIn("book-1", response.text, state)
        with SessionLocal() as db:
            db.query(Invoice).filter(Invoice.id == invoice_id).update({"status": "confirmed"})
            db.commit()
        self.assertEqual(requests.get(status_url).json()["confirmation_message"], message)
        # Return URL and message share invoice metadata; both survive.
        self.assertEqual(requests.get(status_url + "/continue", allow_redirects=False).headers["Location"], "https://merchant.example/thanks")
        # Edits apply to new invoices only.
        requests.patch(self.base + "/api/core/payment-links/" + data["id"], headers=self.headers, json={**self.settings, "confirmation_message": "Changed"}).raise_for_status()
        self.assertEqual(requests.get(status_url).json()["confirmation_message"], message)

    def test_confirmation_message_per_link(self):
        invoices = {}
        for number in range(1, 4):
            _, url = self.create(title=f"Ebook {number}", confirmation_message=f"https://merchant.example/book-{number}.pdf")
            invoices[number] = requests.post(url + "/invoices", allow_redirects=False).headers["Location"].rsplit("/", 1)[1]
        _, plain = self.create(title="No message")
        invoices[0] = requests.post(plain + "/invoices", allow_redirects=False).headers["Location"].rsplit("/", 1)[1]
        with SessionLocal() as db:
            db.query(Invoice).filter(Invoice.id.in_(list(invoices.values()))).update({"status": "confirmed"})
            db.commit()
        for number, invoice_id in invoices.items():
            shown = requests.get(self.base + f"/api/core/public/invoice/{invoice_id}").json()["confirmation_message"]
            self.assertEqual(shown, f"https://merchant.example/book-{number}.pdf" if number else None)

    def test_overrides_and_failures_do_not_create(self):
        _, url = self.create()
        self.assertEqual(requests.post(url + "/invoices", data={"amount_xmr": "1"}).status_code, 400)
        self.assertEqual(requests.post(url + "/invoices?amount_xmr=1").status_code, 400)
        from fastapi import HTTPException
        with patch.object(routes, "create_subaddress_for_user", side_effect=HTTPException(429, "No address available", headers={"Retry-After": "60"})):
            failure = requests.post(url + "/invoices")
            self.assertEqual(failure.status_code, 429)
            self.assertEqual(failure.headers["Retry-After"], "60")
            self.assertIn("text/html", failure.headers["Content-Type"])
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter(Invoice.user_id == self.user_id).count(), 0)

    def test_fiat_and_quote_failure(self):
        from decimal import Decimal
        from app.rates import QuoteResult
        _, url = self.create(amount_xmr=None, amount_fiat="20", currency="EUR")
        with patch.object(routes, "get_xmr_rate", side_effect=RuntimeError("offline")):
            self.assertEqual(requests.post(url + "/invoices").status_code, 503)
        with patch.object(routes, "get_xmr_rate", return_value=QuoteResult(Decimal("100"), "EUR", "fixture", datetime.now(timezone.utc))):
            response = requests.post(url + "/invoices", allow_redirects=False)
            self.assertEqual(response.status_code, 303, response.text)
        with SessionLocal() as db:
            invoice = db.query(Invoice).filter(Invoice.user_id == self.user_id).one()
            self.assertEqual(invoice.amount_xmr, Decimal("0.2"))
            self.assertEqual(invoice.metadata_json["quote"]["source"], "fixture")

    def test_disable_while_purchase_waits_for_merchant_lock(self):
        data, url = self.create()
        observed = threading.Event()
        original = payment_links.enabled_link

        def observed_link(*args):
            result = original(*args)
            observed.set()
            return result

        with SessionLocal() as db:
            db.query(User).filter(User.id == self.user_id).with_for_update().one()
            with patch.object(payment_links, "enabled_link", side_effect=observed_link):
                with ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(requests.post, url + "/invoices", allow_redirects=False, timeout=10)
                    self.assertTrue(observed.wait(5))
                    db.query(PaymentLink).filter(PaymentLink.id == data["id"]).update({"enabled": False})
                    db.commit()
                    self.assertEqual(future.result().status_code, 404)
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter(Invoice.user_id == self.user_id).count(), 0)

    def test_slow_purchase_does_not_block_event_loop_and_closes_session(self):
        from contextlib import contextmanager
        _, url = self.create()
        entered, release = threading.Event(), threading.Event()
        session_threads = []
        closed = []
        @contextmanager
        def session():
            session_threads.append(threading.get_ident())
            with SessionLocal() as db:
                try:
                    yield db
                finally:
                    closed.append(True)
        def slow_address(*args, **kwargs):
            entered.set()
            if not release.wait(5):
                raise RuntimeError("test barrier timed out")
            raise RuntimeError("fixture failure")
        with patch.object(payment_links, "SessionLocal", session), patch.object(routes, "create_subaddress_for_user", side_effect=slow_address):
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(requests.post, url + "/invoices", timeout=10)
                try:
                    self.assertTrue(entered.wait(5))
                    self.assertEqual(requests.get(self.base + "/__test/ping", timeout=1).status_code, 200)
                finally:
                    release.set()
                self.assertEqual(future.result().status_code, 503)
        self.assertEqual(closed, [True])
        self.assertNotEqual(session_threads[0], self.thread.ident)
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter(Invoice.user_id == self.user_id).count(), 0)

    def test_status_and_legacy_state_changes(self):
        data, url = self.create()
        endpoint = self.base + "/api/core/payment-links/status"
        self.assertEqual(requests.get(endpoint).status_code, 401)
        before = requests.get(endpoint, headers=self.headers)
        self.assertEqual(before.headers["Cache-Control"], "no-store")
        self.assertEqual(before.json()["used"], 0)
        requests.post(url + "/invoices", allow_redirects=False).raise_for_status()
        status = requests.get(endpoint, headers=self.headers).json()
        self.assertEqual(status["remaining"], status["daily_limit"] - 1)
        self.assertIn("EUR", status["supported_currencies"])
        with SessionLocal() as db:
            db.query(Invoice).filter(Invoice.user_id == self.user_id).update({"created_at": datetime.now(timezone.utc) - timedelta(days=2)})
            db.query(PaymentLink).filter(PaymentLink.id == data["id"]).update({"amount_xmr": None, "amount_fiat": 20, "currency": "ZZZ"})
            db.commit()
        self.assertEqual(requests.get(endpoint, headers=self.headers).json()["used"], 0)
        patch_url = self.base + "/api/core/payment-links/" + data["id"]
        self.assertEqual(requests.patch(patch_url, headers=self.headers, json={"enabled": False}).status_code, 200)
        self.assertEqual(requests.patch(patch_url, headers=self.headers, json={"enabled": True}).status_code, 422)
        self.assertEqual(requests.post(self.base + "/api/core/payment-links", headers=self.headers, json={"title": "Invalid", "amount_fiat": "20", "currency": "ZZZ"}).status_code, 422)

    def test_parallel_budget_shared_across_links(self):
        _, a = self.create()
        _, b = self.create(title="Second")
        with patch.object(payment_links, "PUBLIC_PAYMENT_LINK_DAILY_LIMIT", 2):
            with ThreadPoolExecutor(max_workers=5) as pool:
                responses = list(pool.map(lambda url: requests.post(url + "/invoices", allow_redirects=False, timeout=20), [a, b, a, b, a]))
        self.assertEqual(sorted(r.status_code for r in responses), [303, 303, 429, 429, 429])
        self.assertTrue(all("Retry-After" in r.headers for r in responses if r.status_code == 429))
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter(Invoice.user_id == self.user_id).count(), 2)
            db.query(Invoice).filter(Invoice.user_id == self.user_id).update({"created_at": datetime.now(timezone.utc) - timedelta(days=2)})
            db.commit()
        with patch.object(payment_links, "PUBLIC_PAYMENT_LINK_DAILY_LIMIT", 2):
            self.assertEqual(requests.post(a + "/invoices", allow_redirects=False).status_code, 303)


    def open_settings(self, **changes):
        return {"title": "Support my project", "description": "", "amount_xmr": None, "customer_amount": True, "confirmation_target": 1, **changes}

    def test_customer_amount_settings(self):
        data, url = self.create(**self.open_settings(minimum_amount_xmr="0.01"))
        self.assertTrue(data["customer_amount"])
        self.assertEqual(data["minimum_amount_xmr"], "0.010000000000")
        self.assertIsNone(data["amount_xmr"])
        public = requests.get(url).json()
        self.assertTrue(public["customer_amount"])
        self.assertIn("EUR", public["supported_currencies"])
        endpoint = self.base + "/api/core/payment-links/" + data["id"]
        for invalid in (self.open_settings(amount_xmr="1"), self.open_settings(amount_fiat="5", currency="EUR"),
                        self.open_settings(auto_create_invoice=True), self.open_settings(minimum_amount_xmr="0.0000000000001"),
                        {**self.settings, "minimum_amount_xmr": "0.1"}):
            response = requests.patch(endpoint, headers=self.headers, json=invalid)
            self.assertEqual(response.status_code, 422, (invalid, response.text))
        self.assertEqual(requests.patch(endpoint, headers=self.headers, json={"enabled": False}).status_code, 200)
        enabled = requests.patch(endpoint, headers=self.headers, json={"enabled": True})
        self.assertEqual(enabled.status_code, 200, enabled.text)
        fixed = requests.patch(endpoint, headers=self.headers, json=self.settings).json()
        self.assertFalse(fixed["customer_amount"])
        self.assertIsNone(fixed["minimum_amount_xmr"])

    def test_customer_amount_purchase(self):
        from decimal import Decimal
        from app.rates import QuoteResult
        _, url = self.create(**self.open_settings(minimum_amount_xmr="0.01"))
        response = requests.post(url + "/invoices", data={"amount": "0.05", "currency": "XMR"}, allow_redirects=False)
        self.assertEqual(response.status_code, 303, response.text)
        with patch.object(routes, "get_xmr_rate", return_value=QuoteResult(Decimal("100"), "EUR", "fixture", datetime.now(timezone.utc))):
            response = requests.post(url + "/invoices", json={"amount": "5", "currency": "eur"}, headers={"Accept": "application/json"})
            self.assertEqual(response.status_code, 201, response.text)
            below = requests.post(url + "/invoices", json={"amount": "0.5", "currency": "EUR"}, headers={"Accept": "application/json"})
            self.assertEqual(below.status_code, 422, below.text)
            self.assertIn("minimum of 0.01 XMR", below.json()["detail"])
        with SessionLocal() as db:
            invoices = db.query(Invoice).filter(Invoice.user_id == self.user_id).order_by(Invoice.created_at).all()
            self.assertEqual([invoice.amount_xmr for invoice in invoices], [Decimal("0.05"), Decimal("0.05")])
            self.assertEqual(invoices[0].metadata_json["payment_link"]["amount_source"], "customer")
            self.assertEqual(invoices[1].metadata_json["quote"]["source"], "fixture")

    def test_customer_amount_rejects_overrides(self):
        _, url = self.create(**self.open_settings())
        for kwargs in ({"data": {"amount": "1", "currency": "XMR", "amount_xmr": "2"}}, {"data": {"amount": "1"}},
                       {"data": {"amount": "1", "currency": "DOGE"}}, {"data": {"amount": "-1", "currency": "XMR"}},
                       {"data": {"amount": "0", "currency": "XMR"}}, {"data": {"amount": "1e3", "currency": "XMR"}},
                       {"data": {"amount": "1.001", "currency": "EUR"}}, {"data": {"amount": "1", "currency": "XMR", "x": "y" * 300}},
                       {"data": "amount=1&amount=2&currency=XMR", "headers": {"Content-Type": "application/x-www-form-urlencoded"}},
                       {"json": {"amount": 1, "currency": "XMR"}}, {"data": "amount=1", "headers": {"Content-Type": "text/plain"}}, {}):
            self.assertEqual(requests.post(url + "/invoices", **kwargs).status_code, 400, kwargs)
        self.assertEqual(requests.post(url + "/invoices?amount=1&currency=XMR").status_code, 400)
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter(Invoice.user_id == self.user_id).count(), 0)


class PaymentLinkValidationTests(unittest.TestCase):
    def test_invalid_templates(self):
        from pydantic import ValidationError
        for payload in ({"title": " ", "amount_xmr": "1"}, {"title": "T", "amount_xmr": "0.0000000000001"}, {"title": "T", "amount_fiat": "20.001", "currency": "EUR"}, {"title": "T", "amount_xmr": "1", "checkout_continue_url": "javascript:alert(1)"}, {"title": "T", "amount_xmr": "1", "metadata": {"wallet": "override"}}):
            with self.assertRaises(ValidationError):
                payment_links.PaymentLinkInput(**payload)

