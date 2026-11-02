"use client";

import { useEffect, useState } from "react";
import { loadInvoiceTransfersAction, type InvoiceTransfersState } from "../app/(app)/dashboard/actions";
import AccessibleDialog from "./accessible-dialog";
import CopyIconButton from "./copy-icon-button";
import Timestamp from "./timestamp";

type InvoiceTransactionsDialogProps = { invoiceId: string; onClose: () => void };
const helpClass = "text-xs leading-relaxed text-ink-soft";
const secondaryButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

export default function InvoiceTransactionsDialog({ invoiceId, onClose }: InvoiceTransactionsDialogProps) {
  const [transfers, setTransfers] = useState<InvoiceTransfersState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadInvoiceTransfersAction(invoiceId)
      .catch((): InvoiceTransfersState => ({ transfers: [], error: "Could not load recorded transactions." }))
      .then(result => { if (active) setTransfers(result); });
    return () => { active = false; };
  }, [invoiceId, attempt]);

  return (
    <AccessibleDialog
      ariaLabelledBy="invoice-transactions-title"
      ariaDescribedBy="invoice-transactions-help"
      onClose={onClose}
      panelClassName="max-h-[calc(100dvh-1.5rem)] max-w-2xl p-5 sm:rounded-surface sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="min-w-0 flex-1 font-sans text-xl font-semibold sm:text-2xl" id="invoice-transactions-title">Recorded transactions</h2>
        <button className={secondaryButton} type="button" onClick={onClose}>Close</button>
      </div>
      <p className="mt-4 text-sm text-ink-soft" id="invoice-transactions-help">
        These are checkout’s recorded observations for this invoice. If a payment is missing, compare the invoice address and transaction ID with your own wallet. Your wallet may show a payment before checkout detects it.
      </p>
      <section className="mt-6" aria-labelledby="invoice-transactions-recorded">
        <h3 className="text-sm font-semibold" id="invoice-transactions-recorded">
          Transactions recorded on this invoice
        </h3>
        {transfers === null ? (
          <p role="status" className={`mt-2 ${helpClass}`}>Loading recorded transactions...</p>
        ) : transfers.error ? (
          <div>
            <p className={`mt-2 ${helpClass}`} role="alert">{transfers.error}</p>
            <button className={`${secondaryButton} mt-3`} type="button" onClick={() => { setTransfers(null); setAttempt(value => value + 1); }}>Retry</button>
          </div>
        ) : transfers.transfers.length === 0 ? (
          <p role="status" className={`mt-2 ${helpClass}`}>No transactions are recorded.</p>
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
                    {transfer.timestamp !== null ? (
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

    </AccessibleDialog>
  );
}
