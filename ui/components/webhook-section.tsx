"use client";

import { useState } from "react";
import { useFormState } from "react-dom";

import {
  createWebhookAction,
  createWebhookTourAction,
  deleteWebhookAction,
  deleteWebhookTourAction,
  type WebhookFormState,
} from "../app/(app)/dashboard/actions";
import ConfirmSubmitButton from "./confirm-submit-button";
import PendingSubmitButton from "./pending-submit-button";
import StatusBadge from "./status-badge";
import { fill } from "../lib/i18n/rich";
import { useI18n } from "./i18n-provider";

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
    event: "invoice.partially_paid",
    key: "invoice_partially_paid",
    label: "invoice.partially_paid",
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
  const { t } = useI18n();
  const emptyEvents = () => Object.fromEntries(webhookEvents.map(({ key }) => [key, { checked: true, url: "" }]));
  const [defaultUrl, setDefaultUrl] = useState("");
  const [events, setEvents] = useState(emptyEvents);
  const [createState, createAction] = useFormState(
    async (previous: WebhookFormState, data: FormData) => {
      const result = await (mode === "tour" ? createWebhookTourAction : createWebhookAction)(previous, data);
      if (result.success) { setDefaultUrl(""); setEvents(emptyEvents()); }
      return result;
    },
    initialState,
  );
  const [deleteState, deleteAction] = useFormState(
    mode === "tour" ? deleteWebhookTourAction : deleteWebhookAction,
    initialState,
  );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-8">
      {mode === "tour" ? (
        <div className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">
          {t("webhooks.demoNote")}
        </div>
      ) : null}
      <form
        className="grid min-w-0 grid-cols-1 gap-6 rounded-surface border border-stroke bg-card p-5 shadow-soft sm:p-6"
        action={createAction}
        onReset={event => event.preventDefault()}
      >
        <div>
          <h2 className="font-sans text-xl font-semibold">{t("webhooks.addEndpoint")}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t("webhooks.addIntro")}
          </p>
          <p className="mt-2 border-l-2 border-sage bg-sage/5 px-3 py-2 text-sm text-ink-soft">
            {t("webhooks.allSelected")}
          </p>
        </div>
        <div className="grid min-w-0 gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft"
            htmlFor="default_url"
          >
            {t("webhooks.defaultUrl")}
          </label>
          <input
            className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
            id="default_url"
            name="default_url"
            value={defaultUrl}
            onChange={event => setDefaultUrl(event.target.value)}
            type="url"
            placeholder="https://xmrcheckout.com/webhooks"
          />
          <p className="text-sm text-ink-soft">
            {t("webhooks.defaultUrlHelp")}
          </p>
        </div>
        <fieldset className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <legend className="sr-only">{t("webhooks.eventsLegend")}</legend>
          {webhookEvents.map(({ event, key, label }) => (
            <div
              key={event}
              className="min-w-0 border-t-2 border-clay/40 bg-white/60 p-4"
            >
              <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                <input
                  className="h-4 w-4 shrink-0 rounded border-stroke text-ink focus:ring-ink/20"
                  type="checkbox"
                  name={`event_${key}`}
                  checked={events[key].checked}
                  onChange={event => setEvents(current => ({ ...current, [key]: { ...current[key], checked: event.target.checked } }))}
                />
                <span className="min-w-0 break-all">{label}</span>
              </label>
              <input
                className="mt-3 w-full rounded-xl border border-stroke bg-white/80 px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                id={`event_url_${key}`}
                name={`event_url_${key}`}
                aria-label={`${label}: ${t("webhooks.overridePlaceholder")}`}
                value={events[key].url}
                onChange={event => setEvents(current => ({ ...current, [key]: { ...current[key], url: event.target.value } }))}
                type="url"
                placeholder={t("webhooks.overridePlaceholder")}
              />
            </div>
          ))}
        </fieldset>
        {createState.error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {createState.error}
          </p>
        ) : null}
        {createState.success ? (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            {createState.success}
          </p>
        ) : null}
        <div className="flex justify-end">
          <PendingSubmitButton
            pendingLabel={t("common.saving")}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
          >
            {t("webhooks.save")}
          </PendingSubmitButton>
        </div>
      </form>
      <div className="border-l-2 border-sage pl-4">
        <p className="text-sm font-semibold text-ink">
          {t("webhooks.pollingTitle")}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {fill(t("webhooks.pollingHelp"), { path: <code className="break-all">/api/core/public/invoice/&lt;invoice_id&gt;</code> })}
        </p>
      </div>
      <div className="grid gap-4">
        <div className="border-b border-stroke pb-3">
          <h2 className="font-sans text-xl font-semibold">
            {t("webhooks.configured")}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t("webhooks.configuredIntro")}
          </p>
        </div>
        {deleteState.error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {deleteState.error}
          </p>
        ) : null}
        {deleteState.success ? (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            {deleteState.success}
          </p>
        ) : null}
        {webhooks.length === 0 ? (
          <p className="text-sm font-semibold text-ink-soft">
            {t("webhooks.none")}
          </p>
        ) : (
          <div className="grid gap-4">
            {webhooks.map((hook) => (
              <div
                key={hook.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-surface border border-stroke bg-white/70 p-5 shadow-soft"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      {t("webhooks.webhook")}
                    </p>
                    <StatusBadge
                      label={hook.active ? t("webhooks.active") : t("webhooks.paused")}
                      tone={hook.active ? "success" : "neutral"}
                    />
                  </div>
                  <code className="mt-2 block break-all rounded-lg bg-ink/10 px-3 py-2 text-sm text-ink">
                    {hook.url || t("webhooks.perEventOnly")}
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
                <form action={deleteAction}>
                  <input type="hidden" name="webhook_id" value={hook.id} />
                  <ConfirmSubmitButton label={t("webhooks.remove")} confirmLabel={t("webhooks.remove")} pendingLabel={t("webhooks.removing")} description={t("webhooks.removeConfirm")} />
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
