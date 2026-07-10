"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";

import {
  redeliverWebhookDeliveryAction,
  redeliverWebhookDeliveryTourAction,
  type WebhookRedeliverState,
} from "../app/(app)/dashboard/actions";
import StatusBadge from "./status-badge";

type WebhookDeliverySummary = {
  id: string;
  webhook_id: string | null;
  event: string;
  url: string;
  invoice_id: string | null;
  invoice_address: string | null;
  invoice_subaddress_index: number | null;
  invoice_amount_xmr: string | null;
  invoice_status:
    "pending" | "payment_detected" | "confirmed" | "expired" | "invalid" | null;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
};

const initialState: WebhookRedeliverState = { error: null, success: null };

export default function WebhookHistoryPanel({
  mode = "live",
  deliveries,
}: {
  mode?: "live" | "tour";
  deliveries: WebhookDeliverySummary[];
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(
    mode === "tour"
      ? redeliverWebhookDeliveryTourAction
      : redeliverWebhookDeliveryAction,
    initialState,
  );

  useEffect(() => {
    if (state.success && mode !== "tour") {
      router.refresh();
    }
  }, [mode, router, state.success]);

  const formatTimestamp = (value: string) => new Date(value).toLocaleString();
  const failedCount = deliveries.filter(
    (delivery) =>
      delivery.http_status === null ||
      (delivery.http_status !== null && delivery.http_status >= 400),
  ).length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stroke pb-4">
        <div>
          <h2 className="font-sans text-xl font-semibold">Delivery attempts</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Inspect responses and retry failed relay attempts explicitly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${deliveries.length} recorded`} />
          <StatusBadge
            label={`${failedCount} need review`}
            tone={failedCount > 0 ? "error" : "success"}
          />
        </div>
      </div>
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {state.success}
        </p>
      ) : null}
      {deliveries.length === 0 ? (
        <p className="rounded-surface border border-stroke bg-white/70 p-5 text-sm text-ink-soft shadow-soft">
          No webhook calls recorded yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {deliveries.map((delivery) => {
            const statusLabel =
              delivery.http_status !== null
                ? delivery.http_status.toString()
                : "No response";
            const isFailed =
              delivery.http_status === null ||
              (typeof delivery.http_status === "number" &&
                delivery.http_status >= 400);
            const hasInvoiceDetails =
              Boolean(delivery.invoice_id) ||
              Boolean(delivery.invoice_address) ||
              Boolean(delivery.invoice_amount_xmr) ||
              delivery.invoice_subaddress_index !== null;
            return (
              <div
                key={delivery.id}
                className={`rounded-surface border bg-white/70 px-4 py-4 shadow-soft ${
                  isFailed ? "border-red-200" : "border-stroke"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      {delivery.event}
                    </p>
                    <p className="mt-2 break-all text-sm font-semibold text-ink">
                      {delivery.url}
                    </p>
                    <p className="mt-2 text-xs text-ink-soft">
                      {formatTimestamp(delivery.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={statusLabel}
                      tone={isFailed ? "error" : "success"}
                    />
                    {isFailed ? (
                      <form action={formAction}>
                        <input
                          type="hidden"
                          name="delivery_id"
                          value={delivery.id}
                        />
                        <button
                          className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
                          type="submit"
                        >
                          Redeliver
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                {hasInvoiceDetails ? (
                  <details className="mt-3 rounded-lg border border-stroke bg-white/70 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.06em] text-ink">
                      View invoice details
                    </summary>
                    <div className="mt-3 grid gap-2 text-xs text-ink-soft">
                      {delivery.invoice_id ? (
                        <div>
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                            Invoice id
                          </p>
                          <p className="mt-1 break-all text-xs text-ink">
                            {delivery.invoice_id}
                          </p>
                        </div>
                      ) : null}
                      {delivery.invoice_address ? (
                        <div>
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                            Subaddress
                          </p>
                          <p className="mt-1 break-all text-xs text-ink">
                            {delivery.invoice_address}
                          </p>
                        </div>
                      ) : null}
                      {delivery.invoice_subaddress_index !== null ? (
                        <div>
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                            Subaddress index
                          </p>
                          <p className="mt-1 text-xs text-ink">
                            {delivery.invoice_subaddress_index}
                          </p>
                        </div>
                      ) : null}
                      {delivery.invoice_amount_xmr ? (
                        <div>
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                            Invoice amount (XMR)
                          </p>
                          <p className="mt-1 text-xs text-ink">
                            {delivery.invoice_amount_xmr}
                          </p>
                        </div>
                      ) : null}
                      {delivery.invoice_status ? (
                        <div>
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                            Invoice status
                          </p>
                          <p className="mt-1 text-xs text-ink">
                            {delivery.invoice_status}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </details>
                ) : null}
                {delivery.error_message ? (
                  <p className="mt-2 text-xs text-ink-soft">
                    Delivery error: {delivery.error_message}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
