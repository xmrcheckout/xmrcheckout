import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app import invoice_limits
from app.models import Invoice, User


class _FakeQuery:
    def __init__(self, model, user, active_count):
        self.model = model
        self.user = user
        self.active_count = active_count
        self.lock_requested = False

    def filter(self, *_args, **_kwargs):
        return self

    def with_for_update(self):
        self.lock_requested = True
        return self

    def first(self):
        return self.user if self.model is User else None

    def scalar(self):
        return self.active_count


class _FakeDb:
    def __init__(self, user, active_count):
        self.user = user
        self.active_count = active_count
        self.user_query = None
        self.added = []

    def query(self, model):
        query = _FakeQuery(model, self.user, self.active_count)
        if model is User:
            self.user_query = query
        return query

    def add(self, value):
        self.added.append(value)

    def flush(self):
        return None


def _user(**overrides):
    values = {
        "id": "user-1",
        "invoice_creation_window_started_at": None,
        "invoice_creation_count": 0,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class InvoiceLimitTests(unittest.TestCase):
    def test_reservation_initializes_a_window_and_locks_user(self):
        user = _user()
        db = _FakeDb(user, active_count=0)

        with patch.multiple(
            invoice_limits,
            INVOICE_ACTIVE_LIMIT=100,
            INVOICE_CREATION_RATE_LIMIT=60,
            INVOICE_CREATION_RATE_WINDOW_SECONDS=60,
        ):
            invoice_limits.reserve_invoice_creation(db, user=user)

        self.assertTrue(db.user_query.lock_requested)
        self.assertEqual(user.invoice_creation_count, 1)
        self.assertIsNotNone(user.invoice_creation_window_started_at)

    def test_rate_limit_returns_retry_after_without_incrementing(self):
        started_at = datetime.now(timezone.utc) - timedelta(seconds=10)
        user = _user(
            invoice_creation_window_started_at=started_at,
            invoice_creation_count=2,
        )
        db = _FakeDb(user, active_count=0)

        with patch.multiple(
            invoice_limits,
            INVOICE_ACTIVE_LIMIT=100,
            INVOICE_CREATION_RATE_LIMIT=2,
            INVOICE_CREATION_RATE_WINDOW_SECONDS=60,
        ):
            with self.assertRaises(HTTPException) as context:
                invoice_limits.reserve_invoice_creation(db, user=user)

        self.assertEqual(context.exception.status_code, 429)
        self.assertIn("Retry-After", context.exception.headers)
        self.assertEqual(user.invoice_creation_count, 2)

    def test_active_limit_is_checked_atomically_before_reservation(self):
        user = _user()
        db = _FakeDb(user, active_count=2)

        with patch.multiple(
            invoice_limits,
            INVOICE_ACTIVE_LIMIT=100,
            INVOICE_CREATION_RATE_LIMIT=60,
            INVOICE_CREATION_RATE_WINDOW_SECONDS=60,
        ):
            with self.assertRaises(HTTPException) as context:
                invoice_limits.reserve_invoice_creation(
                    db,
                    user=user,
                    active_limit=2,
                )

        self.assertEqual(context.exception.status_code, 429)
        self.assertEqual(user.invoice_creation_count, 0)
        self.assertIsNone(user.invoice_creation_window_started_at)


if __name__ == "__main__":
    unittest.main()
