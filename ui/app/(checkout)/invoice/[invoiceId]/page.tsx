import type { Metadata } from "next";
import { notFound } from "next/navigation";

import InvoicePaymentDetails from "../../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh, { InvoiceRefreshFeedback } from "../../../../components/invoice-status-auto-refresh";
import InvoiceStatusActions from "../../../../components/invoice-status-actions";
import InvoiceStatusLookup from "../../../../components/invoice-status-lookup";
import PageIntroBand from "../../../../components/page-intro-band";
import Timestamp from "../../../../components/timestamp";
import StatusRefreshButton from "../../../../components/status-refresh-button";
import { linkifyMessage } from "../../../../lib/linkify";
import {
  hasPartialAmount,
  invoiceStatusLabel,
  type InvoiceStatus,
} from "../../../../lib/invoice-status";
import { getI18n } from "../../../../lib/i18n/server";
import type { Translate } from "../../../../lib/i18n/translate";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("checkout.metaTitle") };
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";


type InvoiceStatusResponse = {
  quote?: { fiat_amount: string; fiat_currency: string; rate: string; source: string; quoted_at: string } | null;
  payment_link_url?: string;
  product_title?: string;
  product_description?: string;
  recipient_name?: string | null;
  description?: string | null;
  id: string;
  address: string;
  subaddress_index: number | null;
  amount_xmr: string;
  amount_paid_xmr?: string | null;
  amount_remaining_xmr?: string | null;
  status: InvoiceStatus;
  checking_delayed?: boolean;
  confirmation_target: number;
  confirmations: number;
  checkout_continue_available?: boolean;
  confirmation_message?: string | null;
  qr_logo?: "monero" | "none" | "custom" | null;
  qr_logo_data_url?: string | null;
  created_at: string;
  expires_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
};
const statusDescription = (
  status: InvoiceStatus,
  hasPartial: boolean,
  t: Translate,
) => {
  if (status === "pending") {
    return t("invoicePage.statusPending");
  }
  if (status === "partially_paid") {
    return t("invoicePage.statusPartial");
  }
  if (status === "expired" && hasPartial) {
    return t("invoicePage.statusExpiredPartial");
  }
  if (status === "invalid") {
    return "";
  }
  return "";
};

export default async function InvoiceStatusDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const { t } = await getI18n();
  const response = await fetch(
    `${apiBaseUrl}/api/core/public/invoice/${encodeURIComponent(invoiceId)}`,
    {
      cache: "no-store",
    },
  ).catch(() => new Response(null, { status: 503 }));

  const invoice = response.ok
    ? (await response.json().catch(() => null)) as InvoiceStatusResponse | null
    : null;
  const retrievedAt = invoice ? new Date().toISOString() : undefined;
  const statusMessage = invoice
    ? t("checkout.statusAnnouncement", {
        status: invoiceStatusLabel(invoice.status, invoice.amount_paid_xmr, invoice.amount_remaining_xmr, t),
        confirmations: invoice.confirmations,
        target: invoice.confirmation_target,
      })
    : "";

  if (response.status === 404 || response.status === 422) notFound();

  if (!response.ok || !invoice) {
    return (
      <InvoiceStatusAutoRefresh
      key={invoiceId}
      retrievedAt={retrievedAt}
      error={!invoice}
      statusMessage={statusMessage}
      status={invoice?.status}
    >
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
        <InvoiceRefreshFeedback />
        <PageIntroBand
          description={t("checkout.loadFailed")}
          eyebrow={t("invoicePage.lookupEyebrow")}
          id="invoice-unavailable"
          title={t("checkout.statusUnavailable")}
        />
        <section className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
          <h2 className="font-sans text-lg font-semibold">{t("invoicePage.tryLookupAgain")}</h2>
          <div className="mt-4 max-w-2xl">
            <InvoiceStatusLookup initialValue={invoiceId} compact />
          </div>
        </section>
      </main>
    </InvoiceStatusAutoRefresh>
    );
  }

  const confirmations = Math.max(0, invoice.confirmations ?? 0);
  const confirmationTarget = Math.max(0, invoice.confirmation_target);
  const hasDetectedPayment =
    invoice.status === "payment_detected" || invoice.status === "confirmed";
  const checkoutContinueAvailable =
    invoice.status === "confirmed" &&
    Boolean(invoice.checkout_continue_available);
  // The API returns the message only for confirmed invoices; this page renders it server side.
  const confirmationMessage =
    invoice.status === "confirmed" && invoice.confirmation_message
      ? invoice.confirmation_message
      : null;
  const timelineItems: {
    label: string;
    timestamp: string | null;
    state: "complete";
  }[] = [];

  timelineItems.push({
    label: t("invoicePage.timelineCreated"),
    timestamp: invoice.created_at,
    state: "complete",
  });

  if (invoice.detected_at) {
    timelineItems.push({
      label: t("invoicePage.timelineDetected"),
      timestamp: invoice.detected_at,
      state: "complete",
    });
  }

  if (invoice.confirmed_at) {
    timelineItems.push({
      label: t("invoicePage.timelineConfirmed"),
      timestamp: invoice.confirmed_at,
      state: "complete",
    });
  }

  if (invoice.status === "expired") {
    timelineItems.push({
      label: t("invoicePage.timelineExpired"),
      timestamp: invoice.expires_at,
      state: "complete",
    });
  }

  const createdTimestamp = invoice.created_at;
  const expiresTimestamp = invoice.expires_at;

  return (
    <InvoiceStatusAutoRefresh
      key={invoiceId}
      retrievedAt={retrievedAt}
      error={!invoice}
      statusMessage={statusMessage}
      status={invoice?.status}
    >
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl px-[6vw] pb-20 pt-10 text-ink">

      <PageIntroBand
        description={statusDescription(
          invoice.status,
          hasPartialAmount(invoice.amount_paid_xmr, invoice.amount_remaining_xmr),
          t,
        )}
        eyebrow={
          invoice.recipient_name
            ? t("invoicePage.paymentTo", { name: invoice.recipient_name })
            : t("invoicePage.eyebrow")
        }
        id="payment-request-title"
        title={invoice.product_title || invoice.description || t("checkout.paymentRequest")}
      />

      {invoice.product_description ? <p className="mt-4 whitespace-pre-wrap break-words">{invoice.product_description}</p> : null}
      {invoice.checking_delayed ? (
        <p className="mt-4 border-l-2 border-clay pl-4 text-sm text-ink-soft">
          {t("checkout.checkingDelayed")}
        </p>
      ) : null}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.65fr)] xl:items-start">
        <InvoicePaymentDetails
          address={invoice.address}
          amount={invoice.amount_xmr}
          amountPaid={invoice.amount_paid_xmr ?? null}
          amountRemaining={invoice.amount_remaining_xmr ?? null}
          hasDetectedPayment={hasDetectedPayment}
          expiresAt={invoice.expires_at}
          expiryRetrievedAt={retrievedAt}
          status={invoice.status}
          confirmationTarget={confirmationTarget}
            confirmations={confirmations}
          qrLogoMode={invoice.qr_logo ?? "monero"}
          qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
          quote={invoice.quote ?? null}
        />

        <aside className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-stroke px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-ink-soft">
                {t("invoicePage.context")}
              </p>
              <h2 className="font-sans mt-1 text-lg font-semibold">{t("invoicePage.details")}</h2>
            </div>
            <StatusRefreshButton />
          </div>

          <dl className="divide-y divide-stroke px-5 py-2 text-sm">
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">
                {t("checkout.invoiceId")}
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-ink">
                {invoiceId}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-4 py-3">
              <div>
                <dt className="text-xs font-semibold text-ink-soft">{t("checkout.created")}</dt>
                <dd
                  className="mt-1 text-sm font-semibold"
                >
                  <Timestamp value={createdTimestamp} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-soft">{t("checkout.expires")}</dt>
                <dd
                  className="mt-1 text-sm font-semibold"
                >
                  <Timestamp value={expiresTimestamp} />
                </dd>
              </div>
            </div>
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">
                {t("checkout.confirmations")}
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {confirmations}/{confirmationTarget}
              </dd>
            </div>
          </dl>

          <p className="border-t border-stroke bg-sand/50 px-5 py-4 text-xs leading-relaxed text-ink-soft">
            {t("invoicePage.publicNotice")}
          </p>
        </aside>
      </div>

      <section
        className="mt-8 border-y border-stroke py-6"
        aria-labelledby="invoice-timeline"
      >
        <h2 className="font-sans text-xl font-semibold" id="invoice-timeline">
          {t("invoicePage.timeline")}
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {timelineItems.map((item) => (
            <li className="border-l-2 border-sage pl-4" key={item.label}>
              <p className="text-xs font-semibold text-ink-soft">
                {item.label}
              </p>
              <p
                className="mt-1 text-sm font-semibold"
              >
                <Timestamp value={item.timestamp} />
              </p>
            </li>
          ))}
        </ol>
      </section>

      {confirmationMessage ? (
        <section aria-labelledby="confirmation-message-heading" className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
          <h2 id="confirmation-message-heading" className="font-sans text-lg font-semibold">{t("invoicePage.merchantMessage")}</h2>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words text-ink">
            {linkifyMessage(confirmationMessage).map((segment, index) =>
              segment.kind === "link" ? (
                <a key={index} href={segment.href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline decoration-clay underline-offset-4">
                  {segment.text}
                </a>
              ) : (
                segment.text
              ),
            )}
          </p>
          <p className="mt-3 text-sm text-ink-soft">{t("invoicePage.merchantMessageNote")}</p>
        </section>
      ) : null}

      <section className="mt-6 flex flex-wrap gap-3">
        {checkoutContinueAvailable ? (
          <a
            className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
            href={`/api/core/public/invoice/${encodeURIComponent(invoiceId)}/continue`}
            rel="noreferrer"
          >
            {t("checkout.continueToMerchant")}
          </a>
        ) : null}
        {invoice.status === "confirmed" ? (
          <a
            className={
              checkoutContinueAvailable
                ? "inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white/75 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                : "inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
            }
            href={`/i/${encodeURIComponent(invoiceId)}/receipt`}
          >
            {t("checkout.viewReceipt")}
          </a>
        ) : null}
        {invoice.payment_link_url && (invoice.status === "confirmed" || (invoice.status === "expired" && !hasPartialAmount(invoice.amount_paid_xmr, invoice.amount_remaining_xmr))) ? <a href={invoice.payment_link_url} className="inline-flex min-h-11 items-center rounded-full border border-stroke px-5 py-3 font-semibold">{t("invoicePage.startAnother")}</a> : null}
        <InvoiceStatusActions />
      </section>
    </main>
    </InvoiceStatusAutoRefresh>
  );
}
