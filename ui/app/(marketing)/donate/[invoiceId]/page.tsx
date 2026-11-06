import type { Metadata } from "next";
import MissingBuyerLink from "../../../../components/missing-buyer-link";
import { notFound } from "next/navigation";

import InvoicePaymentDetails from "../../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh, { InvoiceRefreshFeedback } from "../../../../components/invoice-status-auto-refresh";
import DonationStatusActions from "../../../../components/donation-status-actions";
import PageIntroBand from "../../../../components/page-intro-band";
import Timestamp from "../../../../components/timestamp";
import StatusRefreshButton from "../../../../components/status-refresh-button";
import { areDonationsEnabled } from "../../../../lib/donations";
import {
  invoiceStatusLabel,
  type InvoiceStatus,
} from "../../../../lib/invoice-status";
import { getI18n } from "../../../../lib/i18n/server";
import type { Translate } from "../../../../lib/i18n/translate";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("donate.requestMetaTitle") };
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";


type InvoiceStatusResponse = {
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
  created_at: string;
  expires_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
};

const statusDescription = (
  status: InvoiceStatus,
  t: Translate,
) => {
  if (status === "pending") {
    return t("donate.statusPending");
  }
  if (status === "partially_paid") {
    return t("donate.statusPartial");
  }
  if (status === "invalid") {
    return "";
  }
  return "";
};

export default async function DonateStatusDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  if (!areDonationsEnabled()) {
    notFound();
  }
  const { invoiceId } = await params;
  const { t } = await getI18n();
  const response = await fetch(
    `${apiBaseUrl}/api/core/public/donation/${encodeURIComponent(invoiceId)}`,
    { cache: "no-store" },
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

  if (response.status === 404 || response.status === 422) {
    return <MissingBuyerLink kind="donation" />;
  }

  if (!response.ok || !invoice) {
    return (
      <InvoiceStatusAutoRefresh
      key={invoiceId}
      retrievedAt={retrievedAt}
      error={!invoice}
      statusMessage={statusMessage}
      status={invoice?.status}
    >
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-8 text-ink">
        <InvoiceRefreshFeedback />
        <PageIntroBand
          description={t("donate.loadFailed")}
          eyebrow={t("donate.lookupEyebrow")}
          id="donation-unavailable"
          title={t("checkout.statusUnavailable")}
        />
      </main>
    </InvoiceStatusAutoRefresh>
    );
  }

  const confirmations = Math.max(0, invoice.confirmations ?? 0);
  const confirmationTarget = Math.max(0, invoice.confirmation_target);
  const hasDetectedPayment =
    invoice.status === "payment_detected" || invoice.status === "confirmed";
  const timelineItems: {
    label: string;
    timestamp: string | null;
    state: "complete";
  }[] = [];

  timelineItems.push({
    label: t("donate.timelineCreated"),
    timestamp: invoice.created_at,
    state: "complete",
  });

  if (invoice.detected_at) {
    timelineItems.push({
      label: t("donate.timelineDetected"),
      timestamp: invoice.detected_at,
      state: "complete",
    });
  }

  if (invoice.confirmed_at) {
    timelineItems.push({
      label: t("donate.timelineConfirmed"),
      timestamp: invoice.confirmed_at,
      state: "complete",
    });
  }

  if (invoice.status === "expired") {
    timelineItems.push({
      label: t("donate.timelineExpired"),
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
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl px-[6vw] pb-20 pt-8 text-ink">

      <PageIntroBand
        description={statusDescription(
          invoice.status,
          t,
        )}
        eyebrow={t("donate.eyebrow")}
        id="donation-request-title"
        title={t("donate.title")}
      />

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
        />

        <aside className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-stroke px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-ink-soft">
                {t("donate.context")}
              </p>
              <h2 className="font-sans mt-1 text-lg font-semibold">{t("donate.details")}</h2>
            </div>
            <StatusRefreshButton />
          </div>
          <dl className="divide-y divide-stroke px-5 py-2 text-sm">
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">
                {t("donate.id")}
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
          </dl>
          <p className="border-t border-stroke bg-sand/50 px-5 py-4 text-xs leading-relaxed text-ink-soft">
            {t("donate.publicNotice")}
          </p>
        </aside>
      </div>

      <section
        className="mt-8 border-y border-stroke py-6"
        aria-labelledby="donation-timeline"
      >
        <h2 className="font-sans text-xl font-semibold" id="donation-timeline">
          {t("donate.timeline")}
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...timelineItems].reverse().map((item) => (
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

      <section className="mt-6 flex flex-wrap gap-3">
        <DonationStatusActions />
      </section>
    </main>
    </InvoiceStatusAutoRefresh>
  );
}
