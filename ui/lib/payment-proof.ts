export type PaymentProofResult =
  | "credited"
  | "other_invoice"
  | "predates_invoice"
  | "not_recorded"
  | "no_match"
  | "not_found";

export type PaymentProofOutcome = {
  result: PaymentProofResult;
  proof_type: "tx_key" | "signature";
  received_xmr: string;
  required_xmr: string;
  in_pool: boolean;
  confirmations: number;
  confirmation_target: number;
  bound_to_invoice: boolean;
  checked_at: string;
};

const resultCopy: Record<PaymentProofResult, { title: string; detail: string }> = {
  credited: {
    title: "Proof matches, and this invoice records the payment",
    detail: "This transaction is already counted on this invoice.",
  },
  other_invoice: {
    title: "Proof matches, but the payment belongs to another invoice",
    detail:
      "This address was issued for more than one invoice, and this transaction is recorded on, or falls under, a different one. Check your other invoices for this address.",
  },
  predates_invoice: {
    title: "Proof matches, but the payment came before this invoice",
    detail:
      "This address was used before it was issued for this invoice, so detection does not count this transaction here.",
  },
  not_recorded: {
    title: "Proof matches, but this invoice does not record the payment",
    detail:
      "The view-only wallet has not recorded this transaction. It may be very recent, or older than the wallet's scan range. Check your own wallet before acting on it.",
  },
  no_match: {
    title: "Proof does not match this invoice",
    detail:
      "This key or signature does not show funds sent to this invoice's address in this transaction. Check the values with the customer. A signature's message must match exactly.",
  },
  not_found: {
    title: "Transaction not found",
    detail:
      "The configured Monero daemon does not know this transaction ID. Check it with the customer, or try again shortly if it was sent very recently.",
  },
};

const proofMatched = (result: PaymentProofResult) =>
  result !== "no_match" && result !== "not_found";

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

export function paymentProofSummary(outcome: PaymentProofOutcome): {
  title: string;
  detail: string;
  matched: boolean;
  evidence: string[];
} {
  const copy = resultCopy[outcome.result];
  const matched = proofMatched(outcome.result);
  const evidence: string[] = [];
  if (matched) {
    evidence.push(
      outcome.in_pool
        ? `${outcome.received_xmr} XMR was sent to this invoice's address in this transaction, which is still in the transaction pool with 0 confirmations.`
        : `${outcome.received_xmr} XMR was sent to this invoice's address in this transaction, with ${plural(outcome.confirmations, "confirmation")}.`,
    );
    evidence.push(
      `This invoice asks for ${outcome.required_xmr} XMR with ${plural(outcome.confirmation_target, "confirmation")}. Other transactions to this address are not included in this amount.`,
    );
    evidence.push(
      outcome.bound_to_invoice
        ? "The signature's message is this invoice ID, so the signature was made for this invoice."
        : outcome.proof_type === "signature"
          ? "The signature's message is not this invoice ID, so the signature was not made specifically for this invoice."
          : "A transaction key cannot be tied to a specific invoice. It shows that whoever supplied it knows this transaction's key.",
    );
  }
  return { ...copy, matched, evidence };
}

export const PAYMENT_PROOF_LIMITS =
  "This check does not change the invoice or send webhooks. It does not confirm that the funds are still spendable, and it relies on the configured Monero daemon.";
