"""Validate and classify payment proof checks.

A check is read-only: nothing here writes invoice state, and a matching proof
never credits an invoice. Transaction keys and signatures are secrets supplied
by the sender, so errors use fixed text and never repeat submitted values.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
import math
import re
import threading
import time
from typing import Collection, Iterable, Literal, Protocol

ATOMIC_UNITS_PER_XMR = Decimal(10) ** 12
# One main key plus at most one additional key for each of 16 transaction outputs.
MAX_TX_KEY_PARTS = 17
MAX_MESSAGE_LENGTH = 1024
# Base58 lengths of a 32-byte public key and a 64-byte signature in wallet2.
SIGNATURE_PART_LENGTH = 44 + 88
SIGNATURE_HEADERS = ("OutProofV2", "InProofV2")

_TXID = re.compile(r"[0-9a-f]{64}")
_HEX = re.compile(r"[0-9a-f]+")
_BASE58 = re.compile(r"[1-9A-HJ-NP-Za-km-z]+")

ProofType = Literal["tx_key", "signature"]
ProofResult = Literal[
    "credited", "other_invoice", "predates_invoice", "not_recorded", "no_match", "not_found",
]


class PaymentProofInputError(ValueError):
    """A submitted proof is malformed. The message never contains submitted values."""


@dataclass(frozen=True)
class ValidatedProof:
    txid: str
    proof_type: ProofType
    tx_key: str | None = field(default=None, repr=False)
    signature: str | None = field(default=None, repr=False)
    message: str | None = field(default=None, repr=False)


class AllocationView(Protocol):
    invoice_id: object
    generation: int
    cutoff_height: int | None
    excluded_txids: Collection[str]


def _optional_text(value: object, *, label: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise PaymentProofInputError(f"{label} must be text.")
    return value


def validate_proof_request(body: object) -> ValidatedProof:
    if not isinstance(body, dict):
        raise PaymentProofInputError("Send a JSON object.")
    raw_txid = _optional_text(body.get("txid"), label="Transaction ID")
    txid = (raw_txid or "").strip().lower()
    if not _TXID.fullmatch(txid):
        raise PaymentProofInputError("Transaction ID must be 64 hexadecimal characters.")

    tx_key = (_optional_text(body.get("tx_key"), label="Transaction key") or "").strip().lower()
    signature = (_optional_text(body.get("signature"), label="Signature") or "").strip()
    # The message is hashed into the signature byte for byte, so it is not trimmed.
    message = _optional_text(body.get("message"), label="Message")
    if bool(tx_key) == bool(signature):
        raise PaymentProofInputError("Provide either a transaction key or a signature.")

    if tx_key:
        if message:
            raise PaymentProofInputError("A message can only be used with a signature.")
        if (
            not _HEX.fullmatch(tx_key)
            or len(tx_key) % 64
            or len(tx_key) > 64 * MAX_TX_KEY_PARTS
        ):
            raise PaymentProofInputError(
                "Transaction key must be hexadecimal, in one or more 64-character parts."
            )
        return ValidatedProof(txid=txid, proof_type="tx_key", tx_key=tx_key)

    header = next((item for item in SIGNATURE_HEADERS if signature.startswith(item)), None)
    if header is None:
        raise PaymentProofInputError("Signature must start with OutProofV2 or InProofV2.")
    encoded = signature[len(header):]
    if (
        not _BASE58.fullmatch(encoded)
        or len(encoded) % SIGNATURE_PART_LENGTH
        or len(encoded) > SIGNATURE_PART_LENGTH * MAX_TX_KEY_PARTS
    ):
        raise PaymentProofInputError("Signature is not in the expected format.")
    if message is not None and len(message) > MAX_MESSAGE_LENGTH:
        raise PaymentProofInputError("Message is too long.")
    return ValidatedProof(
        txid=txid, proof_type="signature", signature=signature, message=message or "",
    )


def classify_proof(
    *,
    proof_matches: bool,
    txid: str,
    block_height: int | None,
    invoice_id: object,
    invoice_txids: Collection[str],
    other_invoice_txids: Collection[str],
    allocations: Iterable[AllocationView],
) -> ProofResult:
    """Relate a checked proof to one invoice.

    A subaddress can be reissued, so a matching proof is not enough to show that
    a payment belongs to this invoice. ``block_height`` is None while in the pool.
    """
    if not proof_matches:
        return "no_match"
    if txid in invoice_txids:
        return "credited"
    if txid in other_invoice_txids:
        return "other_invoice"

    allocation_list = list(allocations)
    current = next((row for row in allocation_list if row.invoice_id == invoice_id), None)
    if current is not None and (
        txid in current.excluded_txids
        or (
            block_height is not None
            and current.cutoff_height is not None
            and block_height <= current.cutoff_height
        )
    ):
        return "predates_invoice"

    # A reissued address gives later observations to the newest invoice, which
    # is how the reconciler treats them. Its exclusions were seen before reissue.
    current_generation = current.generation if current is not None else 0
    for newer in allocation_list:
        if newer.generation <= current_generation or txid in newer.excluded_txids:
            continue
        if block_height is None or (
            newer.cutoff_height is not None and block_height > newer.cutoff_height
        ):
            return "other_invoice"
    return "not_recorded"


class ProofRateLimiter:
    """Per-merchant limit, because a check can hold a wallet shard's RPC lock.

    Dashboard requests reach the API without passing the Nginx route limit. Each
    API worker counts separately, which is enough to protect reconciliation.
    """

    def __init__(self, *, limit: int = 10, window_seconds: float = 60.0, clock=time.monotonic) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._attempts: dict[str, list[float]] = {}

    def reserve(self, key: str) -> int | None:
        """Record an attempt, or return the seconds to wait when over the limit."""
        now = self._clock()
        cutoff = now - self._window
        with self._lock:
            for existing, times in list(self._attempts.items()):
                recent = [moment for moment in times if moment > cutoff]
                if recent:
                    self._attempts[existing] = recent
                else:
                    del self._attempts[existing]
            attempts = self._attempts.setdefault(key, [])
            if len(attempts) >= self._limit:
                return max(1, math.ceil(attempts[0] + self._window - now))
            attempts.append(now)
            return None


def atomic_to_xmr(amount_atomic: int) -> Decimal:
    return Decimal(amount_atomic) / ATOMIC_UNITS_PER_XMR
