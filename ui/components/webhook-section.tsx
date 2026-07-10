"use client";

import { useFormState } from "react-dom";

import {
  createWebhookAction,
  createWebhookTourAction,
  deleteWebhookAction,
  deleteWebhookTourAction,
  type WebhookFormState,
} from "../app/(app)/dashboard/actions";
import StatusBadge from "./status-badge";

type WebhookSummary = {
  id: string;
  url: string;
  events: string[];
  event_urls?: Record<string, string> | null;
  active: boolean;
  created_at: string;
};

const initialState: WebhookFormState = { error: null, success: null };

const webhookEvents = [
  {
    event: "invoice.created",
    key: "invoice_created",
    label: "invoice.created",
  },
  {
    event: "invoice.payment_detected",
    key: "invoice_payment_detected",
    label: "invoice.payment_detected",
  },
  {
    event: "invoice.confirmed",
    key: "invoice_confirmed",
    label: "invoice.confirmed",
  },
  {
    event: "invoice.expired",
    key: "invoice_expired",
    label: "invoice.expired",
  },
];

type WebhookSectionProps = {
  mode?: "live" | "tour";
  webhooks: WebhookSummary[];
};

export default function WebhookSection({
  mode = "live",
  webhooks,
}: WebhookSectionProps) {
  const [createState, createAction] = useFormState(
    mode === "tour" ? createWebhookTourAction : createWebhookAction,
    initialState,
  );
  const [deleteState, deleteAction] = useFormState(
    mode === "tour" ? deleteWebhookTourAction : deleteWebhookAction,
    initialState,
  );

  return (
    <div className="grid gap-8">
      {mode === "tour" ? (
        <div className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">
          Tour mode: webhook changes are simulated. No endpoints are saved.
        </div>
      ) : null}
      <form
        className="grid gap-6 rounded-surface border border-stroke bg-card p-5 shadow-soft sm:p-6"
        action={createAction}
      >
        <div>
          <h2 className="font-sans text-xl font-semibold">Add an endpoint</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Select the invoice events to relay and optionally route events to
            separate URLs.
          </p>
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft"
            htmlFor="default_url"
          >
            Default webhook URL
          </label>
          <input
            className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
            id="default_url"
            name="default_url"
            type="url"
            placeholder="https://xmrcheckout.com/webhooks"
          />
          <p className="text-sm text-ink-soft">
            Used for any selected event without a specific override URL.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {webhookEvents.map(({ event, key, label }) => (
            <div
              key={event}
              className="border-t-2 border-clay/40 bg-white/60 p-4"
            >
              <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                <input
                  className="h-4 w-4 rounded border-stroke text-ink focus:ring-ink/20"
                  type="checkbox"
                  name={`event_${key}`}
                  defaultChecked
                />
                <span>{label}</span>
              </label>
              <input
                className="mt-3 w-full rounded-xl border border-stroke bg-white/80 px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                id={`event_url_${key}`}
                name={`event_url_${key}`}
                type="url"
                placeholder="Optional override URL"
              />
            </div>
          ))}
        </div>
        {createState.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {createState.error}
          </p>
        ) : null}
        {createState.success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            {createState.success}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
            type="submit"
          >
            Save webhook
          </button>
        </div>
      </form>
      <div className="border-l-2 border-sage pl-4">
        <p className="text-sm font-semibold text-ink">
          Polling remains available
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Webhooks are optional. You can poll{" "}
          <code>/api/core/public/invoice/&lt;invoice_id&gt;</code> without
          authentication to read invoice status.
        </p>
      </div>
      <div className="grid gap-4">
        <div className="border-b border-stroke pb-3">
          <h2 className="font-sans text-xl font-semibold">
            Configured endpoints
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Review the exact destination used for each selected event.
          </p>
        </div>
        {deleteState.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {deleteState.error}
          </p>
        ) : null}
        {deleteState.success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            {deleteState.success}
          </p>
        ) : null}
        {webhooks.length === 0 ? (
          <p className="text-sm font-semibold text-ink-soft">
            No webhooks configured yet.
          </p>
        ) : (
          <form className="grid gap-4" action={deleteAction}>
            {webhooks.map((hook) => (
              <div
                key={hook.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-surface border border-stroke bg-white/70 p-5 shadow-soft"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      Webhook
                    </p>
                    <StatusBadge
                      label={hook.active ? "Active" : "Paused"}
                      tone={hook.active ? "success" : "neutral"}
                    />
                  </div>
                  <code className="mt-2 block break-all rounded-lg bg-ink/10 px-3 py-2 text-sm text-ink">
                    {hook.url || "Per-event URLs only"}
                  </code>
                  <div className="mt-4 grid gap-3">
                    {hook.events.map((event) => (
                      <div key={event} className="grid gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                          {event}
                        </span>
                        <code className="break-all rounded-lg bg-ink/10 px-3 py-2 text-sm text-ink">
                          {hook.event_urls?.[event] ?? hook.url}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex">
                  <button
                    className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
                    type="submit"
                    name="webhook_id"
                    value={hook.id}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </form>
        )}
      </div>
    </div>
  );
}
