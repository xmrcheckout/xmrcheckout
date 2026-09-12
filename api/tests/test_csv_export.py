import csv
import io
import json
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app import routes


class InvoiceCsvExportTests(unittest.IsolatedAsyncioTestCase):
    async def test_metadata_round_trips_as_json(self):
        metadata = {"note": 'Café, "quoted"\nsecond line', "enabled": True,
                    "optional": None, "items": [{"count": 2}]}
        invoices = [
            SimpleNamespace(
                id=uuid4(), status="pending", amount_xmr=Decimal("0.125"),
                confirmation_target=10, confirmations=0, paid_after_expiry=False,
                paid_after_expiry_at=None, address="fixture-address",
                subaddress_index=1, created_at=None, expires_at=None,
                detected_at=None, confirmed_at=None, archived_at=None,
                metadata_json=value,
            )
            for value in (metadata, {}, None)
        ]
        query = MagicMock()
        query.filter.return_value = query
        query.order_by.return_value = query
        query.yield_per.return_value = invoices
        db = MagicMock()
        db.query.return_value = query
        with patch.object(routes, "_get_user_for_api_key",
                          return_value=SimpleNamespace(id=uuid4())):
            response = routes.export_invoices_csv(
                include_archived=False, status_filter=None, active_only=False,
                q=None, sort="created_at", order="desc", created_from=None,
                created_to=None, db=db, api_key="fixture",
            )
            chunks = [chunk async for chunk in response.body_iterator]
        rows = list(csv.DictReader(io.StringIO("".join(chunks))))
        self.assertEqual(json.loads(rows[0]["metadata"]), metadata)
        self.assertEqual(json.loads(rows[1]["metadata"]), {})
        self.assertEqual(rows[2]["metadata"], "")
