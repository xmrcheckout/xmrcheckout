"use client";

import { startTransition, useEffect, useState } from "react";
import { useFormState } from "react-dom";

import {
  checkPaymentProofAction,
  loadInvoiceTransfersAction,
  type InvoiceTransfersState,
  type PaymentProofState,
} from "../app/(app)/dashboard/actions";
import {
  PAYMENT_PROOF_LIMITS,
  paymentProofSummary,
} from "../lib/payment-proof";
import AccessibleDialog from "./accessible-dialog";
import CopyIconButton from "./copy-icon-button";
import Timestamp from "./timestamp";

type PaymentProofDialogProps = {
  invoiceId: string;
  onClose: () => void;
};

const labelClass = "text-sm font-semibold text-ink";
const helpClass = "text-xs leading-relaxed text-ink-soft";
const inputClass =
  "mt-1 w-full min-w-0 rounded-xl border border-stroke bg-white/80 px-4 py-3 font-mono text-xs text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10";
const primaryButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";
const secondaryButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

const initialState: PaymentProofState = { outcome: null, error: null };

export default function PaymentProofDialog({
  invoiceId,
  onClose,
}: PaymentProofDialogProps) {
  const [proofType, setProofType] = useState<"tx_key" | "signature">("tx_key");
  const [txid, setTxid] = useState("");
  const [txKey, setTxKey] = useState("");
  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState("");
  const [transfers, setTransfers] = useState<InvoiceTransfersState | null>(null);

  // Secrets stay in the form while a check can be retried, then are cleared
  // once the check gives an answer.
  const [state, formAction, pending] = useFormState(
    async (previous: PaymentProofState, formData: FormData) => {
      const next = await checkPaymentProofAction(previous, formData);
      if (next.outcome) {
        setTxKey("");
        setSignature("");
        setMessage("");
      }
      return next;
    },
    initialState,
  );

  useEffect(() => {
    let active = true;
    loadInvoiceTransfersAction(invoiceId)
      .catch(
        (): InvoiceTransfersState => ({
          transfers: [],
          error: "Could not load recorded transactions.",
        }),
      )
      .then((result) => {
        if (active) setTransfers(result);
      });
    return () => {
      active = false;
    };
  }, [invoiceId]);

  const summary = state.outcome ? paymentProofSummary(state.outcome) : null;
  const missingProof =
    !txid.trim() ||
    (proofType === "tx_key" ? !txKey.trim() : !signature.trim());

  return (
    <AccessibleDialog
      ariaLabelledBy="payment-proof-title"
      ariaDescribedBy="payment-proof-limits"
      onClose={onClose}
      panelClassName="max-h-[calc(100dvh-1.5rem)] max-w-2xl p-5 sm:rounded-surface sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2
            className="font-sans text-xl font-semibold sm:text-2xl"
            id="payment-proof-title"
          >
            Check payment proof
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Ask the customer for the transaction ID and either the transaction
            key or a signature from their wallet. Never ask for a recovery seed
            or private spend key.
          </p>
        </div>
        <button className={secondaryButton} type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <p
        className="mt-4 border-l-2 border-clay pl-4 text-sm leading-relaxed text-ink-soft"
        id="payment-proof-limits"
      >
        {PAYMENT_PROOF_LIMITS}
      </p>

      <section className="mt-6" aria-labelledby="payment-proof-recorded">
        <h3 className="text-sm font-semibold" id="payment-proof-recorded">
          Transactions recorded on this invoice
        </h3>
        {transfers === null ? (
          <p className={`mt-2 ${helpClass}`}>Loading recorded transactions...</p>
        ) : transfers.error ? (
          <p className={`mt-2 ${helpClass}`} role="alert">
            {transfers.error}
          </p>
        ) : transfers.transfers.length === 0 ? (
          <p className={`mt-2 ${helpClass}`}>No transactions are recorded.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {transfers.transfers.map((transfer) => (
              <li
                className="flex min-w-0 items-start gap-2 rounded-xl border border-stroke bg-white/60 p-3"
                key={transfer.txid}
              >
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-xs">{transfer.txid}</p>
                  <p className={`mt-1 ${helpClass}`}>
                    {transfer.amount_xmr} XMR, {transfer.confirmations}{" "}
                    {transfer.confirmations === 1
                      ? "confirmation"
                      : "confirmations"}
                    {transfer.timestamp ? (
                      <>
                        {", "}
                        <Timestamp
                          value={new Date(
                            transfer.timestamp * 1000,
                          ).toISOString()}
                        />
                      </>
                    ) : null}
                  </p>
                </div>
                <CopyIconButton
                  value={transfer.txid}
                  label="Copy transaction ID"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Submitted by hand because React resets a form given an action, which
          would return the proof type radio to its default after each check. */}
      <form
        autoComplete="off"
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
      >
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <div>
          <label className={labelClass} htmlFor="payment-proof-txid">
            Transaction ID
          </label>
          <input
            autoComplete="off"
            className={inputClass}
            id="payment-proof-txid"
            name="txid"
            onChange={(event) => setTxid(event.target.value)}
            required
            spellCheck={false}
            type="text"
            value={txid}
          />
        </div>

        <fieldset>
          <legend className={labelClass}>Proof from the customer</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex min-h-11 items-center gap-2">
              <input
                checked={proofType === "tx_key"}
                name="proof_type"
                onChange={() => setProofType("tx_key")}
                type="radio"
                value="tx_key"
              />
              Transaction key
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                checked={proofType === "signature"}
                name="proof_type"
                onChange={() => setProofType("signature")}
                type="radio"
                value="signature"
              />
              Signature
            </label>
          </div>
        </fieldset>

        {proofType === "tx_key" ? (
          <div>
            <label className={labelClass} htmlFor="payment-proof-key">
              Transaction key
            </label>
            <textarea
              aria-describedby="payment-proof-key-help"
              autoComplete="off"
              className={inputClass}
              id="payment-proof-key"
              name="tx_key"
              onChange={(event) => setTxKey(event.target.value)}
              required
              rows={2}
              spellCheck={false}
              value={txKey}
            />
            <p className={`mt-1 ${helpClass}`} id="payment-proof-key-help">
              It can be longer than 64 characters when a transaction has several
              recipients. Enter the whole value. It is not stored or logged.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className={labelClass} htmlFor="payment-proof-signature">
                Signature
              </label>
              <textarea
                aria-describedby="payment-proof-signature-help"
                autoComplete="off"
                className={inputClass}
                id="payment-proof-signature"
                name="signature"
                onChange={(event) => setSignature(event.target.value)}
                required
                rows={3}
                spellCheck={false}
                value={signature}
              />
              <p
                className={`mt-1 ${helpClass}`}
                id="payment-proof-signature-help"
              >
                Starts with OutProofV2 or InProofV2. It is not stored or logged.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="payment-proof-message">
                Signed message
              </label>
              <input
                aria-describedby="payment-proof-message-help"
                autoComplete="off"
                className={inputClass}
                id="payment-proof-message"
                name="message"
                onChange={(event) => setMessage(event.target.value)}
                spellCheck={false}
                type="text"
                value={message}
              />
              <div
                className={`mt-1 flex min-w-0 items-center gap-2 ${helpClass}`}
                id="payment-proof-message-help"
              >
                <p className="min-w-0 flex-1 break-words">
                  Must match exactly, or stay empty if none was used. To tie a
                  signature to this invoice, ask the customer to sign this
                  invoice ID: <span className="break-all font-mono">{invoiceId}</span>
                </p>
                <CopyIconButton value={invoiceId} label="Copy invoice ID" />
              </div>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            aria-busy={pending}
            className={primaryButton}
            disabled={missingProof || pending}
            type="submit"
          >
            {pending ? "Checking..." : "Check proof"}
          </button>
          <span className="sr-only" role="status" aria-live="polite">
            {pending ? "Checking..." : ""}
          </span>
        </div>
      </form>

      {state.error ? (
        <div
          className="mt-5 rounded-xl border border-clay/50 bg-white/70 p-4"
          role="alert"
        >
          <p className="text-sm font-semibold">Could not complete this check</p>
          <p className="mt-1 text-sm text-ink-soft">{state.error}</p>
        </div>
      ) : null}

      {state.outcome && summary ? (
        <div
          className="mt-5 rounded-xl border border-stroke bg-white/70 p-4"
          role="status"
        >
          <p className="text-base font-semibold">{summary.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{summary.detail}</p>
          {summary.evidence.length > 0 ? (
            <ul className="mt-3 grid list-disc gap-1 pl-5 text-sm text-ink-soft">
              {summary.evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className={`mt-3 ${helpClass}`}>
            Checked <Timestamp value={state.outcome.checked_at} />
          </p>
        </div>
      ) : null}
    </AccessibleDialog>
  );
}
