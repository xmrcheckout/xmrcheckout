import asyncio
from contextlib import nullcontext
from datetime import datetime, timezone
from decimal import Decimal
import json
import logging
import os
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import HTTPException
from monero.backends.jsonrpc.exceptions import RPCError
from requests import ConnectionError as RequestsConnectionError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app import routes
from app.config import DATABASE_URL
from app.db import Base
from app.models import Invoice, InvoiceTransfer, SubaddressAllocation, User
from app.monero_service import DaemonTransaction, MoneroWalletService, ProofCheck
from app.payment_proof import (
    PaymentProofInputError,
    ProofRateLimiter,
    SIGNATURE_PART_LENGTH,
    atomic_to_xmr,
    classify_proof,
    validate_proof_request,
)

TXID = "ab" * 32
KEY = "cd" * 32
SIGNATURE = "OutProofV2" + "2" * SIGNATURE_PART_LENGTH
SECRET_CANARY = "e" * 63 + "z"


def allocation(invoice_id, generation, cutoff=None, excluded=()):
    return SimpleNamespace(
        invoice_id=invoice_id, generation=generation, cutoff_height=cutoff, excluded_txids=list(excluded),
    )


class ValidationTests(unittest.TestCase):
    def rejected(self, body):
        with self.assertRaises(PaymentProofInputError) as raised:
            validate_proof_request(body)
        return str(raised.exception)

    def test_accepts_and_normalizes_transaction_key(self):
        proof = validate_proof_request({"txid": f"  {TXID.upper()}\n", "tx_key": f" {KEY.upper()} "})
        self.assertEqual((proof.txid, proof.proof_type, proof.tx_key), (TXID, "tx_key", KEY))

    def test_accepts_multi_part_transaction_keys_up_to_the_cap(self):
        self.assertEqual(
            validate_proof_request({"txid": TXID, "tx_key": KEY * 17}).tx_key, KEY * 17,
        )
        self.rejected({"txid": TXID, "tx_key": KEY * 18})

    def test_rejects_malformed_transaction_keys(self):
        for tx_key in (KEY[:-1], KEY + "a", SECRET_CANARY):
            self.rejected({"txid": TXID, "tx_key": tx_key})

    def test_rejects_malformed_transaction_ids(self):
        for txid in (None, 7, "", TXID[:-1], "z" * 64):
            self.rejected({"txid": txid, "tx_key": KEY})

    def test_requires_exactly_one_proof(self):
        self.rejected({"txid": TXID})
        self.rejected({"txid": TXID, "tx_key": KEY, "signature": SIGNATURE})
        self.rejected({"txid": TXID, "tx_key": "  ", "signature": ""})

    def test_rejects_non_object_and_non_text_values(self):
        for body in (None, [], "text", {"txid": TXID, "tx_key": 12}, {"txid": TXID, "signature": ["x"]}):
            self.rejected(body)

    def test_rejects_message_with_transaction_key(self):
        self.rejected({"txid": TXID, "tx_key": KEY, "message": "order"})

    def test_signature_message_is_preserved_exactly(self):
        proof = validate_proof_request({"txid": TXID, "signature": f" {SIGNATURE} ", "message": " order 1\n"})
        self.assertEqual(proof.signature, SIGNATURE)
        self.assertEqual(proof.message, " order 1\n")

    def test_missing_signature_message_is_the_empty_message(self):
        self.assertEqual(validate_proof_request({"txid": TXID, "signature": SIGNATURE}).message, "")

    def test_accepts_in_proof_and_multiple_parts(self):
        signature = "InProofV2" + "3" * (SIGNATURE_PART_LENGTH * 2)
        self.assertEqual(validate_proof_request({"txid": TXID, "signature": signature}).signature, signature)

    def test_rejects_old_and_malformed_signatures(self):
        for signature in (
            "OutProofV1" + "2" * SIGNATURE_PART_LENGTH,
            "InProofV1" + "2" * SIGNATURE_PART_LENGTH,
            "OutProofV2",
            "OutProofV2" + "2" * (SIGNATURE_PART_LENGTH - 1),
            "OutProofV2" + "0" * SIGNATURE_PART_LENGTH,
            "OutProofV2" + "2" * (SIGNATURE_PART_LENGTH * 18),
            "Other" + "2" * SIGNATURE_PART_LENGTH,
        ):
            self.rejected({"txid": TXID, "signature": signature})

    def test_rejects_long_message(self):
        self.rejected({"txid": TXID, "signature": SIGNATURE, "message": "m" * 1025})

    def test_errors_never_repeat_submitted_values(self):
        for body in (
            {"txid": TXID, "tx_key": SECRET_CANARY},
            {"txid": SECRET_CANARY, "tx_key": KEY},
            {"txid": TXID, "signature": SECRET_CANARY},
            {"txid": TXID, "tx_key": SECRET_CANARY, "signature": SECRET_CANARY},
        ):
            self.assertNotIn(SECRET_CANARY, self.rejected(body))

    def test_repr_hides_secrets(self):
        text = repr(validate_proof_request({"txid": TXID, "signature": SIGNATURE, "message": "private"}))
        self.assertNotIn(SIGNATURE, text)
        self.assertNotIn("private", text)
        self.assertNotIn(KEY, repr(validate_proof_request({"txid": TXID, "tx_key": KEY})))


class ClassificationTests(unittest.TestCase):
    def classify(self, *, matches=True, height=1000, invoice_txids=(), other=(), allocations=()):
        return classify_proof(
            proof_matches=matches, txid=TXID, block_height=height, invoice_id="current",
            invoice_txids=set(invoice_txids), other_invoice_txids=set(other), allocations=allocations,
        )

    def test_no_match_wins(self):
        self.assertEqual(self.classify(matches=False, invoice_txids=[TXID]), "no_match")

    def test_credited(self):
        self.assertEqual(self.classify(invoice_txids=[TXID]), "credited")

    def test_recorded_on_another_invoice(self):
        self.assertEqual(self.classify(other=[TXID]), "other_invoice")

    def test_credited_wins_over_exclusion(self):
        rows = [allocation("current", 1, 2000, [TXID])]
        self.assertEqual(self.classify(invoice_txids=[TXID], allocations=rows), "credited")

    def test_not_recorded_without_allocations(self):
        self.assertEqual(self.classify(), "not_recorded")

    def test_not_recorded_on_first_use_allocation(self):
        self.assertEqual(self.classify(allocations=[allocation("current", 1)]), "not_recorded")

    def test_reused_address_at_and_either_side_of_cutoff(self):
        rows = [allocation("old", 1), allocation("current", 2, 1000)]
        self.assertEqual(self.classify(height=999, allocations=rows), "predates_invoice")
        self.assertEqual(self.classify(height=1000, allocations=rows), "predates_invoice")
        self.assertEqual(self.classify(height=1001, allocations=rows), "not_recorded")

    def test_excluded_txid_predates_invoice_even_above_cutoff(self):
        rows = [allocation("current", 2, 1000, [TXID])]
        self.assertEqual(self.classify(height=1500, allocations=rows), "predates_invoice")

    def test_newer_allocation_owns_later_payments(self):
        rows = [allocation("current", 1), allocation("new", 2, 1000)]
        self.assertEqual(self.classify(height=1000, allocations=rows), "not_recorded")
        self.assertEqual(self.classify(height=1001, allocations=rows), "other_invoice")

    def test_newer_allocation_owns_pool_transactions(self):
        rows = [allocation("current", 1), allocation("new", 2, 1000)]
        self.assertEqual(self.classify(height=None, allocations=rows), "other_invoice")

    def test_transaction_seen_before_reissue_stays_with_older_invoice(self):
        rows = [allocation("current", 1), allocation("new", 2, 1000, [TXID])]
        self.assertEqual(self.classify(height=None, allocations=rows), "not_recorded")
        self.assertEqual(self.classify(height=1500, allocations=rows), "not_recorded")

    def test_pool_transaction_on_latest_allocation_is_not_recorded(self):
        self.assertEqual(self.classify(height=None, allocations=[allocation("current", 2, 1000)]), "not_recorded")

    def test_older_allocations_do_not_claim_payments(self):
        rows = [allocation("old", 1), allocation("current", 2, 500)]
        self.assertEqual(self.classify(height=1000, allocations=rows), "not_recorded")

    def test_invoice_without_allocation_yields_to_issued_allocations(self):
        self.assertEqual(self.classify(height=1001, allocations=[allocation("new", 1, 1000)]), "other_invoice")


class AmountTests(unittest.TestCase):
    def test_atomic_conversion_is_exact(self):
        self.assertEqual(atomic_to_xmr(1), Decimal("0.000000000001"))
        self.assertEqual(atomic_to_xmr(18_446_744_073_709_551_615), Decimal("18446744.073709551615"))


class DaemonLookupTests(unittest.TestCase):
    def setUp(self):
        self.service = object.__new__(MoneroWalletService)
        self.service._daemon_url = "http://daemon:18081"

    def lookup(self, payload=None, error=None, http_error=None):
        response = Mock()
        response.json.return_value = payload
        response.raise_for_status.side_effect = http_error
        with patch("app.monero_service.requests.post", return_value=response, side_effect=error) as post:
            result = self.service.get_daemon_transaction(TXID)
        self.assertEqual(post.call_args.kwargs["json"]["txs_hashes"], [TXID])
        return result

    def assert_unavailable(self, **kwargs):
        with self.assertRaises(HTTPException) as raised:
            self.lookup(**kwargs)
        self.assertEqual(raised.exception.status_code, 503)

    def test_missing_transaction_is_definite(self):
        self.assertFalse(self.lookup({"status": "OK", "missed_tx": [TXID]}).found)

    def test_mined_transaction_returns_height(self):
        result = self.lookup({"status": "OK", "txs": [{"tx_hash": TXID, "in_pool": False, "block_height": 42}]})
        self.assertEqual((result.found, result.in_pool, result.block_height), (True, False, 42))

    def test_pool_transaction_has_no_height(self):
        result = self.lookup({"status": "OK", "txs": [{"tx_hash": TXID, "in_pool": True, "block_height": 0}]})
        self.assertEqual((result.found, result.in_pool, result.block_height), (True, True, None))

    def test_failures_are_never_reported_as_missing(self):
        self.assert_unavailable(error=RequestsConnectionError("daemon down"))
        self.assert_unavailable(http_error=RequestsConnectionError("bad gateway"))
        for payload in (
            None,
            [],
            {"status": "BUSY", "missed_tx": [TXID]},
            {"status": "OK"},
            {"status": "OK", "missed_tx": ["other"]},
            {"status": "OK", "missed_tx": "bad"},
            {"status": "OK", "txs": [{"tx_hash": "other", "in_pool": True}]},
            {"status": "OK", "txs": [{"tx_hash": TXID, "in_pool": False, "block_height": 0}]},
            {"status": "OK", "txs": [{"tx_hash": TXID, "in_pool": "no", "block_height": 5}]},
            {"status": "OK", "txs": [{"tx_hash": TXID}, {"tx_hash": TXID}]},
        ):
            self.assert_unavailable(payload=payload)

    def test_unconfigured_daemon_is_unavailable(self):
        self.service._daemon_url = None
        with self.assertRaises(HTTPException) as raised:
            self.service.get_daemon_transaction(TXID)
        self.assertEqual(raised.exception.status_code, 503)


class WalletProofCheckTests(unittest.TestCase):
    def setUp(self):
        self.service = object.__new__(MoneroWalletService)
        self.client = Mock()
        self.service._wallet_name = Mock(return_value="wallet")
        self.service._backend_for_wallet_name = Mock(return_value=SimpleNamespace(client=self.client))
        self.service._wallet_rpc_lock = Mock(return_value=nullcontext())
        self.service._ensure_wallet_open = Mock()
        self.service._ensure_daemon = Mock()
        self.service._ensure_wallet_synced = Mock()
        self.user = SimpleNamespace(payment_address="primary", view_key_encrypted="encrypted")

    def check(self, **kwargs):
        with patch("app.monero_service.decrypt_secret", return_value="view"):
            return self.service.check_payment_proof(self.user, txid=TXID, address="sub", **kwargs)

    def test_transaction_key_check_uses_the_invoice_address(self):
        self.client.raw_request.return_value = {"received": 5, "in_pool": False, "confirmations": 3}
        result = self.check(tx_key=KEY)
        self.client.raw_request.assert_called_once_with(
            "check_tx_key", {"txid": TXID, "tx_key": KEY, "address": "sub"},
        )
        self.assertEqual((result.good, result.received_atomic, result.confirmations), (True, 5, 3))
        self.service._ensure_wallet_synced.assert_not_called()

    def test_omitted_zero_fields_mean_no_funds_in_key_check(self):
        self.client.raw_request.return_value = {"received": 0}
        self.assertEqual(self.check(tx_key=KEY).received_atomic, 0)

    def test_signature_check_passes_message_exactly(self):
        self.client.raw_request.return_value = {"good": True, "received": 9, "in_pool": True, "confirmations": 0}
        result = self.check(signature=SIGNATURE, message=" order ")
        self.client.raw_request.assert_called_once_with(
            "check_tx_proof",
            {"txid": TXID, "address": "sub", "message": " order ", "signature": SIGNATURE},
        )
        self.assertTrue(result.in_pool)

    def test_bad_signature_is_not_a_match_and_ignores_other_fields(self):
        self.client.raw_request.return_value = {"good": False, "received": 99}
        result = self.check(signature=SIGNATURE, message="")
        self.assertEqual((result.good, result.received_atomic), (False, 0))

    def test_malformed_wallet_signature_error_is_input_error(self):
        self.client.raw_request.side_effect = RPCError("Signature decoding error")
        with self.assertRaises(HTTPException) as raised:
            self.check(signature=SIGNATURE, message="")
        self.assertEqual(raised.exception.status_code, 400)

    def test_wallet_failures_are_unavailable_and_not_no_match(self):
        for error in (
            RPCError("Failed to connect to daemon"),
            RequestsConnectionError("wallet down"),
            HTTPException(status_code=503, detail="Monero wallet RPC is busy"),
            HTTPException(status_code=409, detail="Wallet file exists"),
        ):
            self.client.raw_request.side_effect = error
            with self.assertRaises(HTTPException) as raised:
                self.check(tx_key=KEY)
            self.assertEqual(raised.exception.status_code, 503)
            self.assertNotIn("Wallet file", str(raised.exception.detail))

    def test_malformed_wallet_responses_are_unavailable(self):
        for method_kwargs, response in (
            ({"tx_key": KEY}, []),
            ({"tx_key": KEY}, {}),
            ({"tx_key": KEY}, {"received": "5"}),
            ({"tx_key": KEY}, {"received": -1}),
            ({"tx_key": KEY}, {"received": 5, "confirmations": "1"}),
            ({"signature": SIGNATURE}, {"received": 5}),
            ({"signature": SIGNATURE}, {"good": "true", "received": 5}),
            ({"signature": SIGNATURE}, {"good": True}),
        ):
            self.client.raw_request.side_effect = None
            self.client.raw_request.return_value = response
            with self.assertRaises(HTTPException) as raised:
                self.check(**method_kwargs)
            self.assertEqual(raised.exception.status_code, 503)

    def test_secrets_are_not_logged_on_failure(self):
        self.client.raw_request.side_effect = RPCError("Failed to get transaction from daemon")
        with self.assertLogs("app.monero_service", level="WARNING") as logs:
            with self.assertRaises(HTTPException) as raised:
                self.check(tx_key=KEY)
        self.assertNotIn(KEY, "\n".join(logs.output))
        self.assertNotIn(KEY, str(raised.exception.detail))


class RateLimiterTests(unittest.TestCase):
    def test_limits_each_merchant_and_recovers(self):
        now = [100.0]
        limiter = ProofRateLimiter(limit=2, window_seconds=60, clock=lambda: now[0])
        self.assertIsNone(limiter.reserve("a"))
        self.assertIsNone(limiter.reserve("a"))
        self.assertEqual(limiter.reserve("a"), 60)
        self.assertIsNone(limiter.reserve("b"))
        now[0] = 160.5
        self.assertIsNone(limiter.reserve("a"))


class BodyParsingTests(unittest.TestCase):
    def read(self, body):
        async def request_body():
            return body
        return asyncio.run(routes._read_payment_proof_body(SimpleNamespace(body=request_body)))

    def test_invalid_json_does_not_repeat_the_body(self):
        with self.assertRaises(HTTPException) as raised:
            self.read(b'{"tx_key": "' + KEY.encode())
        self.assertEqual(raised.exception.status_code, 400)
        self.assertNotIn(KEY, str(raised.exception.detail))

    def test_large_body_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            self.read(b" " * (routes.PAYMENT_PROOF_MAX_BODY_BYTES + 1))
        self.assertEqual(raised.exception.status_code, 413)

    def test_valid_json_is_returned(self):
        self.assertEqual(self.read(json.dumps({"txid": TXID}).encode()), {"txid": TXID})


class ProofRouteTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(id=uuid4())
        self.invoice = SimpleNamespace(
            id=uuid4(), address="invoice-address", amount_xmr=Decimal("1.5"), confirmation_target=3,
        )
        self.db = Mock()
        self.service = Mock()
        self.service.get_daemon_transaction.return_value = DaemonTransaction(found=True, block_height=100)
        self.service.check_payment_proof.return_value = ProofCheck(True, 1_500_000_000_000, False, 4)
        patches = [
            patch.object(routes, "_get_merchant_invoice_for_proof", return_value=(self.user, self.invoice)),
            patch.object(routes, "MoneroWalletService", return_value=self.service),
            patch.object(routes, "_load_proof_context", return_value=({TXID}, set(), [])),
            patch.object(routes, "_payment_proof_rate_limiter", ProofRateLimiter()),
            patch.object(routes, "dispatch_webhooks"),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        self.webhooks = routes.dispatch_webhooks

    def post(self, **body):
        response = SimpleNamespace(headers={})
        result = routes.check_invoice_payment_proof(
            self.invoice.id, response, db=self.db, api_key="key", body={"txid": TXID, **body},
        )
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        return result

    def test_matching_key_reports_amounts_without_changing_anything(self):
        before = dict(vars(self.invoice))
        result = self.post(tx_key=KEY)
        self.assertEqual(result.result, "credited")
        self.assertEqual((result.received_xmr, result.required_xmr, result.confirmations), ("1.5", "1.5", 4))
        self.assertFalse(result.bound_to_invoice)
        self.assertEqual(vars(self.invoice), before)
        for method in (self.db.add, self.db.commit, self.db.delete, self.db.flush, self.db.execute, self.webhooks):
            method.assert_not_called()

    def test_checks_the_invoice_address_and_ignores_a_submitted_address(self):
        self.post(tx_key=KEY, address="attacker-address")
        self.assertEqual(self.service.check_payment_proof.call_args.kwargs["address"], "invoice-address")

    def test_missing_transaction_is_not_found_without_a_wallet_call(self):
        self.service.get_daemon_transaction.return_value = DaemonTransaction(found=False)
        self.assertEqual(self.post(tx_key=KEY).result, "not_found")
        self.service.check_payment_proof.assert_not_called()

    def test_zero_received_and_bad_signature_are_no_match(self):
        self.service.check_payment_proof.return_value = ProofCheck(True, 0, False, 4)
        self.assertEqual(self.post(tx_key=KEY).result, "no_match")
        self.service.check_payment_proof.return_value = ProofCheck(False, 0, False, 0)
        self.assertEqual(self.post(signature=SIGNATURE).result, "no_match")

    def test_failures_are_unavailable_rather_than_no_match(self):
        unavailable = HTTPException(status_code=503, detail="Could not check")
        self.service.get_daemon_transaction.side_effect = unavailable
        with self.assertRaises(HTTPException) as raised:
            self.post(tx_key=KEY)
        self.assertEqual(raised.exception.status_code, 503)
        self.service.get_daemon_transaction.side_effect = None
        self.service.check_payment_proof.side_effect = unavailable
        with self.assertRaises(HTTPException) as raised:
            self.post(tx_key=KEY)
        self.assertEqual(raised.exception.status_code, 503)

    def test_signature_is_bound_only_when_message_is_exactly_the_invoice_id(self):
        self.assertTrue(self.post(signature=SIGNATURE, message=str(self.invoice.id)).bound_to_invoice)
        self.assertFalse(self.post(signature=SIGNATURE, message=f" {self.invoice.id}").bound_to_invoice)
        self.assertFalse(self.post(signature=SIGNATURE).bound_to_invoice)

    def test_pool_status_from_the_wallet_removes_block_height(self):
        self.service.check_payment_proof.return_value = ProofCheck(True, 5, True, 0)
        with patch.object(routes, "classify_proof", return_value="not_recorded") as classify:
            self.assertTrue(self.post(tx_key=KEY).in_pool)
        self.assertIsNone(classify.call_args.kwargs["block_height"])

    def test_input_errors_are_400_and_never_repeat_secrets(self):
        with self.assertRaises(HTTPException) as raised:
            self.post(tx_key=SECRET_CANARY)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertNotIn(SECRET_CANARY, str(raised.exception.detail))
        self.service.get_daemon_transaction.assert_not_called()

    def test_rate_limit_returns_429_before_any_wallet_work(self):
        limiter = ProofRateLimiter(limit=1)
        limiter.reserve(str(self.user.id))
        with patch.object(routes, "_payment_proof_rate_limiter", limiter):
            with self.assertRaises(HTTPException) as raised:
                self.post(tx_key=KEY)
        self.assertEqual(raised.exception.status_code, 429)
        self.assertIn("Retry-After", raised.exception.headers)
        self.service.get_daemon_transaction.assert_not_called()

    def test_secrets_are_not_logged_by_a_successful_check(self):
        with self.assertLogs(level=logging.DEBUG) as logs:
            logging.getLogger("proof-test").debug("start")
            self.post(signature=SIGNATURE, message="private-message")
        output = "\n".join(logs.output)
        self.assertNotIn(SIGNATURE, output)
        self.assertNotIn("private-message", output)


class MerchantAccessTests(unittest.TestCase):
    def test_other_merchants_invoice_is_not_found(self):
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = None
        with patch.object(routes, "_get_user_for_api_key", return_value=SimpleNamespace(id=uuid4())):
            with self.assertRaises(HTTPException) as raised:
                routes._get_merchant_invoice_for_proof(db, "key", uuid4())
        self.assertEqual(raised.exception.status_code, 404)

    def test_non_user_key_is_rejected(self):
        with patch.object(routes, "_get_user_for_api_key", return_value=None):
            with self.assertRaises(HTTPException) as raised:
                routes._get_merchant_invoice_for_proof(Mock(), "key", uuid4())
        self.assertEqual(raised.exception.status_code, 401)


@unittest.skipUnless(os.getenv("SUBADDRESS_DATABASE_TESTS") == "1", "requires isolated PostgreSQL schema")
class ProofDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.schema = "test_proof_" + uuid4().hex
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
            db.add(SubaddressAllocation(invoice_id=self.older_id, user_id=self.user_id, address="shared",
                                        subaddress_index=1, generation=1, excluded_txids=[]))
            db.add(SubaddressAllocation(invoice_id=self.invoice_id, user_id=self.user_id, address="shared",
                                        subaddress_index=1, generation=2, cutoff_height=50, excluded_txids=["x"]))
            db.add(SubaddressAllocation(invoice_id=self.foreign_id, user_id=self.other_user_id, address="shared",
                                        subaddress_index=1, generation=3, excluded_txids=[]))

    def clean(self):
        self.engine.dispose()
        with self.admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))
        self.admin.dispose()

    def add_transfer(self, invoice_id, txid=TXID, amount=5):
        with self.Session.begin() as db:
            db.add(InvoiceTransfer(invoice_id=invoice_id, txid=txid, amount_atomic=amount, confirmations=2,
                                   timestamp=1_800_000_000))

    def context(self, db):
        return routes._load_proof_context(
            db, user=SimpleNamespace(id=self.user_id),
            invoice=db.get(Invoice, self.invoice_id), txid=TXID,
        )

    def test_context_separates_this_invoice_from_other_invoices(self):
        with self.Session() as db:
            invoice_txids, other_txids, allocations = self.context(db)
        self.assertEqual((invoice_txids, other_txids), (set(), set()))
        self.assertEqual({row.invoice_id for row in allocations}, {self.invoice_id, self.older_id})

        self.add_transfer(self.older_id)
        with self.Session() as db:
            self.assertEqual(self.context(db)[:2], (set(), {TXID}))
        self.add_transfer(self.invoice_id)
        with self.Session() as db:
            self.assertEqual(self.context(db)[:2], ({TXID}, {TXID}))

    def test_context_ignores_another_merchants_records(self):
        self.add_transfer(self.foreign_id)
        with self.Session() as db:
            self.assertEqual(self.context(db)[:2], (set(), set()))

    def test_lookup_scopes_invoices_and_allows_archived(self):
        with self.Session.begin() as db:
            db.get(Invoice, self.invoice_id).archived_at = datetime.now(timezone.utc)
        user = SimpleNamespace(id=self.user_id)
        with self.Session() as db, patch.object(routes, "_get_user_for_api_key", return_value=user):
            self.assertEqual(routes._get_merchant_invoice_for_proof(db, "key", self.invoice_id)[1].id, self.invoice_id)
            with self.assertRaises(HTTPException) as raised:
                routes._get_merchant_invoice_for_proof(db, "key", self.foreign_id)
        self.assertEqual(raised.exception.status_code, 404)

    def test_transfer_listing_skips_zero_amounts_and_formats_xmr(self):
        self.add_transfer(self.invoice_id, amount=1_250_000_000_000)
        self.add_transfer(self.invoice_id, txid="cd" * 32, amount=0)
        user = SimpleNamespace(id=self.user_id)
        with self.Session() as db, patch.object(routes, "_get_user_for_api_key", return_value=user):
            rows = routes.list_invoice_transfers(self.invoice_id, db=db, api_key="key")
        self.assertEqual([(row.txid, row.amount_xmr) for row in rows], [(TXID, "1.25")])


if __name__ == "__main__":
    unittest.main()
