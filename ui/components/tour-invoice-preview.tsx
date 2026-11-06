"use client";

import Link from "next/link";

import { SimulatedCheckoutDetails, useSimulatedInvoice } from "./simulated-checkout-preview";
import { useI18n } from "./i18n-provider";
import type { Translate } from "../lib/i18n/translate";
import { utcTimestamp } from "../lib/timestamps";

type TourInvoicePreviewProps = {
  invoice: {
    id: string;
    address: string;
    subaddress_index?: number | null;
    amount_xmr: string;
    status: "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
    confirmation_target: number;
    confirmations?: number | null;
    created_at: string;
    detected_at: string | null;
    confirmed_at: string | null;
    expires_at: string | null;
    metadata?: Record<string, string> | null;
  };
};

const formatTimestampFor = (value: string | null, t: Translate) =>
  value ? utcTimestamp(value, t) : "-";

export default function TourInvoicePreview({
  invoice,
}: TourInvoicePreviewProps) {
  const { t } = useI18n();
  const formatTimestamp = (value: string | null) => formatTimestampFor(value, t);
  const { snapshot, setStatus } = useSimulatedInvoice(invoice.confirmation_target, invoice.status, invoice.created_at, invoice.expires_at);
  const { confirmations, timeline: timelineItems } = snapshot;

  return (
    <article className="grid gap-6" aria-labelledby="tour-invoice-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stroke pb-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2 w-2 rounded-full bg-clay" aria-hidden="true" />
            {t("demo.invoice.view")}
          </p>
          <h1
            className="mt-1 font-sans text-3xl font-semibold leading-tight"
            id="tour-invoice-title"
          >
            {t("demo.invoice.title")}
          </h1>
          <p className="mt-2 text-ink-soft">
            {t("demo.invoice.intro")}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
          href="/tour?tab=invoices"
        >
          {t("demo.invoice.back")}
        </Link>
      </header>

      <div className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">
        {t("demo.invoice.notice")}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.65fr)] xl:items-start">
        <SimulatedCheckoutDetails
          amount={invoice.amount_xmr}
          target={invoice.confirmation_target}
          description={invoice.metadata?.description}
          expiry={formatTimestamp(invoice.expires_at)}
          snapshot={snapshot}
          onStatusChange={setStatus}
        />

        <aside className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <div className="border-b border-stroke px-5 py-4">
            <p className="text-xs font-semibold text-ink-soft">
              {t("dashboard.invoices.context")}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{t("demo.invoice.details")}</h2>
          </div>

          <dl className="divide-y divide-stroke px-5 py-2 text-sm">
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">{t("demo.invoice.id")}</dt>
              <dd className="mt-1 break-all font-mono text-xs text-ink">
                {invoice.id}
              </dd>
            </div>
            <div className="py-3">
                <dt className="text-xs font-semibold text-ink-soft">{t("demo.invoice.created")}</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {formatTimestamp(invoice.created_at)}
                </dd>
                <dt className="mt-3 text-xs font-semibold text-ink-soft">{t("demo.invoice.expires")}</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {formatTimestamp(invoice.expires_at)}
                </dd>
            </div>
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">
                {t("dashboard.invoices.confirmations")}
              </dt>
              <dd data-testid="context-confirmations" className="mt-1 text-sm font-semibold">
                {confirmations}/{invoice.confirmation_target}
              </dd>
            </div>
            {invoice.subaddress_index !== null &&
            invoice.subaddress_index !== undefined ? (
              <div className="py-3">
                <dt className="text-xs font-semibold text-ink-soft">
                  {t("dashboard.invoices.subaddressIndex")}
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold">
                  {invoice.subaddress_index}
                </dd>
              </div>
            ) : null}
            {invoice.metadata?.description ? (
              <div className="py-3">
                <dt className="text-xs font-semibold text-ink-soft">
                  {t("dashboard.invoices.description")}
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {invoice.metadata.description}
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="border-t border-stroke bg-sand/50 px-5 py-4 text-xs leading-relaxed text-ink-soft">
            {t("demo.invoice.public")}
          </p>
        </aside>
      </div>

      <section className="border-y border-stroke py-6" aria-labelledby="tour-invoice-timeline">
        <h2 className="text-xl font-semibold" id="tour-invoice-timeline">
          {t("demo.invoice.timeline")}
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {timelineItems.map((item) => (
            <li className="border-l-2 border-sage pl-4" key={item.event}>
              <p className="text-xs font-semibold text-ink-soft">{t(`demo.timeline.${item.event}`)}</p>
              <p className="mt-1 text-sm font-semibold">
                {formatTimestamp(item.value)}
              </p>
            </li>
          ))}
        </ol>
      </section>

    </article>
  );
}
