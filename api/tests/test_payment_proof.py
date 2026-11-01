from decimal import Decimal
from types import SimpleNamespace
import unittest

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


if __name__ == "__main__":
    unittest.main()
