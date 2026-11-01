from contextlib import nullcontext
from decimal import Decimal
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException
from monero.backends.jsonrpc.exceptions import RPCError
from requests import ConnectionError as RequestsConnectionError

from app.monero_service import MoneroWalletService
from app.payment_proof import (
    PaymentProofInputError,
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


if __name__ == "__main__":
    unittest.main()
