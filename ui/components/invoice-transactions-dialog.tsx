"use client";

import { useEffect, useState } from "react";
import { loadInvoiceTransfersAction, type InvoiceTransfersState } from "../app/(app)/dashboard/actions";
import AccessibleDialog from "./accessible-dialog";
import CopyIconButton from "./copy-icon-button";
import Timestamp from "./timestamp";
import { useI18n } from "./i18n-provider";

type InvoiceTransactionsDialogProps = { invoiceId: string; onClose: () => void };
const helpClass = "text-xs leading-relaxed text-ink-soft";
const secondaryButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

export default function InvoiceTransactionsDialog({ invoiceId, onClose }: InvoiceTransactionsDialogProps) {
  const { t } = useI18n();
  const [transfers, setTransfers] = useState<InvoiceTransfersState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadInvoiceTransfersAction(invoiceId)
      .catch((): InvoiceTransfersState => ({ transfers: [], error: t("transactions.loadFailed") }))
      .then(result => { if (active) setTransfers(result); });
    return () => { active = false; };
  }, [invoiceId, attempt, t]);

  return (
    <AccessibleDialog
      ariaLabelledBy="invoice-transactions-title"
      ariaDescribedBy="invoice-transactions-help"
      onClose={onClose}
      panelClassName="max-h-[calc(100dvh-1.5rem)] max-w-2xl p-5 sm:rounded-surface sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="min-w-0 flex-1 font-sans text-xl font-semibold sm:text-2xl" id="invoice-transactions-title">{t("transactions.title")}</h2>
        <button className={secondaryButton} type="button" onClick={onClose}>{t("common.close")}</button>
      </div>
      <p className="mt-4 text-sm text-ink-soft" id="invoice-transactions-help">
        {t("transactions.help")}
      </p>
      <section className="mt-6" aria-labelledby="invoice-transactions-recorded">
        <h3 className="text-sm font-semibold" id="invoice-transactions-recorded">
          {t("transactions.recorded")}
        </h3>
        {transfers === null ? (
          <p role="status" className={`mt-2 ${helpClass}`}>{t("transactions.loading")}</p>
        ) : transfers.error ? (
          <div>
            <p className={`mt-2 ${helpClass}`} role="alert">{transfers.error}</p>
            <button className={`${secondaryButton} mt-3`} type="button" onClick={() => { setTransfers(null); setAttempt(value => value + 1); }}>{t("refresh.retry")}</button>
          </div>
        ) : transfers.transfers.length === 0 ? (
          <p role="status" className={`mt-2 ${helpClass}`}>{t("transactions.none")}</p>
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
                    {t("transactions.summary", { amount: transfer.amount_xmr, count: transfer.confirmations })}
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
                  label={t("transactions.copyTxid")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

    </AccessibleDialog>
  );
}
