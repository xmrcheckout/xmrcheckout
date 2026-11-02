from datetime import datetime, timezone
from decimal import Decimal
import os
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app import routes
from app.config import DATABASE_URL
from app.db import Base
from app.models import Invoice, InvoiceTransfer, User
from app.formatting import atomic_to_xmr

TXID = "ab" * 32

class MerchantAccessTests(unittest.TestCase):
    def test_other_merchants_invoice_is_not_found(self):
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = None
        with patch.object(routes, "_get_user_for_api_key", return_value=SimpleNamespace(id=uuid4())):
            with self.assertRaises(HTTPException) as raised:
                routes._get_merchant_invoice_for_transfers(db, "key", uuid4())
        self.assertEqual(raised.exception.status_code, 404)

    def test_non_user_key_is_rejected(self):
        with patch.object(routes, "_get_user_for_api_key", return_value=None):
            with self.assertRaises(HTTPException) as raised:
                routes._get_merchant_invoice_for_transfers(Mock(), "key", uuid4())
        self.assertEqual(raised.exception.status_code, 401)



class RemovedEndpointTests(unittest.TestCase):
    def test_removed_endpoint_is_absent(self):
        app = FastAPI()
        app.include_router(routes.router)
        path = f"/api/core/invoices/{uuid4()}/payment-proof"
        import asyncio
        messages = []
        async def receive():
            return {"type": "http.request", "body": b"{}", "more_body": False}
        async def send(message):
            messages.append(message)
        asyncio.run(app({"type": "http", "method": "POST", "path": path, "root_path": "", "query_string": b"", "headers": [], "scheme": "http", "server": ("test", 80)}, receive, send))
        self.assertEqual(messages[0]["status"], 404)
        self.assertFalse(any("payment-proof" in path for path in app.openapi()["paths"]))

    def test_atomic_conversion_is_exact(self):
        self.assertEqual(atomic_to_xmr(1), Decimal("0.000000000001"))
        self.assertEqual(atomic_to_xmr(18_446_744_073_709_551_615), Decimal("18446744.073709551615"))

@unittest.skipUnless(os.getenv("SUBADDRESS_DATABASE_TESTS") == "1", "requires isolated PostgreSQL schema")
class TransferDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.schema = "test_transfers_" + uuid4().hex
        self.admin = create_engine(DATABASE_URL)
        with self.admin.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.engine = create_engine(DATABASE_URL, connect_args={"options": f"-csearch_path={self.schema}"})
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.addCleanup(self.clean)
        self.user_id, self.other_user_id = uuid4(), uuid4()
        self.invoice_id, self.older_id, self.foreign_id = uuid4(), uuid4(), uuid4()
        with self.Session.begin() as db:
            for user_id, address in ((self.user_id, "merchant"), (self.other_user_id, "other")):
                db.add(User(id=user_id, payment_address=address, view_key_encrypted="view",
                            api_key_hash=f"hash-{address}", api_key_encrypted="key"))
            db.flush()
            for invoice_id, owner, metadata in (
                (self.invoice_id, self.user_id, None),
                (self.older_id, self.user_id, None),
                (self.foreign_id, self.other_user_id, None),
            ):
                db.add(Invoice(id=invoice_id, user_id=owner, address="shared", amount_xmr=Decimal("1"),
                               status="pending", confirmation_target=1, metadata_json=metadata))
            db.flush()

    def clean(self):
        self.engine.dispose()
        with self.admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))
        self.admin.dispose()

    def add_transfer(self, invoice_id, txid=TXID, amount=5, timestamp=1_800_000_000):
        with self.Session.begin() as db:
            db.add(InvoiceTransfer(invoice_id=invoice_id, txid=txid, amount_atomic=amount, confirmations=2,
                                   timestamp=timestamp))

    def test_lookup_scopes_invoices_and_allows_archived(self):
        with self.Session.begin() as db:
            db.get(Invoice, self.invoice_id).archived_at = datetime.now(timezone.utc)
        user = SimpleNamespace(id=self.user_id)
        with self.Session() as db, patch.object(routes, "_get_user_for_api_key", return_value=user):
            self.assertEqual(routes._get_merchant_invoice_for_transfers(db, "key", self.invoice_id)[1].id, self.invoice_id)
            with self.assertRaises(HTTPException) as raised:
                routes._get_merchant_invoice_for_transfers(db, "key", self.foreign_id)
        self.assertEqual(raised.exception.status_code, 404)

    def test_transfer_listing_skips_zero_amounts_and_formats_xmr(self):
        self.add_transfer(self.invoice_id, amount=1_250_000_000_000)
        self.add_transfer(self.invoice_id, txid="cd" * 32, amount=0)
        user = SimpleNamespace(id=self.user_id)
        with self.Session() as db, patch.object(routes, "_get_user_for_api_key", return_value=user):
            rows = routes.list_invoice_transfers(self.invoice_id, db=db, api_key="key")
        self.assertEqual([(row.txid, row.amount_xmr) for row in rows], [(TXID, "1.25")])

    def test_listing_is_scoped_and_sorted_without_side_effects(self):
        self.add_transfer(self.invoice_id, txid="bb" * 32, timestamp=20)
        self.add_transfer(self.invoice_id, txid="aa" * 32, timestamp=20)
        self.add_transfer(self.invoice_id, txid="cc" * 32, timestamp=10)
        self.add_transfer(self.invoice_id, txid="dd" * 32, timestamp=None)
        self.add_transfer(self.foreign_id)
        self.add_transfer(self.older_id)
        with self.Session() as db, patch.object(routes, "_get_user_for_api_key", return_value=SimpleNamespace(id=self.user_id)), patch.object(routes, "MoneroWalletService") as wallet, patch.object(routes, "dispatch_webhooks") as webhooks, patch.object(db, "commit") as commit, patch.object(db, "add") as add:
            rows = routes.list_invoice_transfers(self.invoice_id, db=db, api_key="key")
            self.assertEqual([row.txid for row in rows], [letter * 64 for letter in "cabd"])
            self.assertFalse(db.new or db.dirty or db.deleted)
            for operation in (wallet, webhooks, commit, add):
                operation.assert_not_called()

    def test_empty_invoice_has_no_transactions(self):
        with self.Session() as db, patch.object(routes, "_get_user_for_api_key", return_value=SimpleNamespace(id=self.user_id)):
            self.assertEqual(routes.list_invoice_transfers(self.invoice_id, db=db, api_key="key"), [])


if __name__ == "__main__":
    unittest.main()
