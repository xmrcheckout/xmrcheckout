import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app import btcpay_routes

USER = SimpleNamespace(id="user-1")


class _FakeQuery:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def filter(self, *criteria):
        self.calls.append(("filter", len(criteria)))
        return self

    def order_by(self, *criteria):
        self.calls.append(("order_by", len(criteria)))
        return self

    def offset(self, value):
        self.calls.append(("offset", value))
        return self

    def limit(self, value):
        self.calls.append(("limit", value))
        return self

    def all(self):
        return list(self.rows)


class _FakeDb:
    def __init__(self, rows):
        self.query_obj = _FakeQuery(rows)

    def query(self, model):
        return self.query_obj


def _list(db, **kwargs):
    params = {"skip": 0, "take": btcpay_routes.BTCPAY_INVOICE_LIST_DEFAULT_TAKE}
    params.update(kwargs)
    with patch.object(
        btcpay_routes,
        "_btcpay_invoice_response",
        side_effect=lambda _db, invoice, _request: {"id": invoice},
    ):
        return btcpay_routes.list_invoices(
            store_id=str(USER.id), request=None, user=USER, db=db, **params
        )


class BtcpayInvoiceListTests(unittest.TestCase):
    def test_returns_invoices_in_query_order(self):
        db = _FakeDb(["newest", "older"])
        self.assertEqual(_list(db), [{"id": "newest"}, {"id": "older"}])
        calls = db.query_obj.calls
        self.assertIn(("filter", 2), calls)
        self.assertIn(("order_by", 1), calls)

    def test_skip_and_take_are_applied(self):
        db = _FakeDb([])
        _list(db, skip=5, take=1)
        self.assertIn(("offset", 5), db.query_obj.calls)
        self.assertIn(("limit", 1), db.query_obj.calls)

    def test_take_is_capped(self):
        db = _FakeDb([])
        _list(db, take=10_000)
        self.assertIn(
            ("limit", btcpay_routes.BTCPAY_INVOICE_LIST_MAX_TAKE), db.query_obj.calls
        )

    def test_wrong_store_is_not_found(self):
        with self.assertRaises(HTTPException) as ctx:
            btcpay_routes.list_invoices(
                store_id="other-store",
                request=None,
                skip=0,
                take=1,
                user=USER,
                db=_FakeDb([]),
            )
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
