import type { Metadata } from "next";
import { notFound } from "next/navigation";

import InvoicePaymentDetails from "../../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh, { InvoiceRefreshFeedback } from "../../../../components/invoice-status-auto-refresh";
import InvoiceStatusActions from "../../../../components/invoice-status-actions";
import InvoiceStatusLookup from "../../../../components/invoice-status-lookup";
import PageIntroBand from "../../../../components/page-intro-band";
import { formatRelativeTime } from "../../../../components/relative-time";
import Timestamp from "../../../../components/timestamp";
import StatusRefreshButton from "../../../../components/status-refresh-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Payment Request",
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

type InvoiceStatus =
  "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";

type InvoiceStatusResponse = {
  quote?: { fiat_amount: string; fiat_currency: string; rate: string; source: string; quoted_at: string } | null;
  payment_link_url?: string;
  product_title?: string;
  product_description?: string;
  id: string;
  address: string;
  subaddress_index: number | null;
  amount_xmr: string;
  status: InvoiceStatus;
  confirmation_target: number;
  confirmations: number;
  checkout_continue_available?: boolean;
  qr_logo?: "monero" | "none" | "custom" | null;
  qr_logo_data_url?: string | null;
  created_at: string;
  expires_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
};
const statusDescription = (
  status: InvoiceStatus,
  confirmationTarget: number,
  confirmations: number,
) => {
  if (status === "pending") {
    return "Waiting for a payment to be detected on-chain.";
  }
  if (status === "payment_detected") {
    return `Payment detected. ${confirmations}/${confirmationTarget} confirmations.`;
  }
  if (status === "confirmed") {
    return `Payment confirmed on-chain at ${confirmationTarget} confirmations.`;
  }
  if (status === "invalid") {
    return "";
  }
  return "";
};

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return { label: "-", relative: null };
  }
  return {
    label: new Date(value).toLocaleString(),
    relative: formatRelativeTime(value),
  };
};

export default async function InvoiceStatusDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
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
    ? `${invoice.status === "pending" ? "Awaiting funds" : invoice.status.replaceAll("_", " ")}. ${invoice.confirmations}/${invoice.confirmation_target} confirmations.`
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
      <main className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
        <InvoiceRefreshFeedback />
        <PageIntroBand
          description="We could not load this invoice status. Refresh the page or try again later."
          eyebrow="Invoice lookup"
          id="invoice-unavailable"
          title="Status unavailable"
        />
        <section className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
          <h2 className="text-lg font-semibold">Try the lookup again</h2>
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
  const timelineItems: {
    label: string;
    timestamp: ReturnType<typeof formatTimestamp>;
    state: "complete";
  }[] = [];

  timelineItems.push({
    label: "Invoice created",
    timestamp: formatTimestamp(invoice.created_at),
    state: "complete",
  });

  if (invoice.detected_at) {
    timelineItems.push({
      label: "Payment detected",
      timestamp: formatTimestamp(invoice.detected_at),
      state: "complete",
    });
  }

  if (invoice.confirmed_at) {
    timelineItems.push({
      label: "Payment confirmed",
      timestamp: formatTimestamp(invoice.confirmed_at),
      state: "complete",
    });
  }

  if (invoice.status === "expired") {
    timelineItems.push({
      label: "Invoice expired",
      timestamp: formatTimestamp(invoice.expires_at),
      state: "complete",
    });
  }

  const createdTimestamp = formatTimestamp(invoice.created_at);
  const expiresTimestamp = formatTimestamp(invoice.expires_at);

  return (
    <InvoiceStatusAutoRefresh
      key={invoiceId}
      retrievedAt={retrievedAt}
      error={!invoice}
      statusMessage={statusMessage}
      status={invoice?.status}
    >
      <main className="mx-auto w-full max-w-7xl px-[6vw] pb-20 pt-10 text-ink">
      <PageIntroBand
        description={statusDescription(
          invoice.status,
          confirmationTarget,
          confirmations,
        )}
        eyebrow="Direct-to-wallet invoice"
        id="payment-request-title"
        title={invoice.product_title || "Payment request"}
      />

      {invoice.product_description ? <p className="mt-4 whitespace-pre-wrap break-words">{invoice.product_description}</p> : null}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.65fr)] xl:items-start">
        <InvoicePaymentDetails
          address={invoice.address}
          amount={invoice.amount_xmr}
          hasDetectedPayment={hasDetectedPayment}
          status={invoice.status}
          confirmationTarget={confirmationTarget}
            confirmations={confirmations}
          qrLogoMode={invoice.qr_logo ?? "monero"}
          qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
        />

        <aside className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-stroke px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-ink-soft">
                Invoice context
              </p>
              <h2 className="mt-1 text-lg font-semibold">Invoice details</h2>
            </div>
            <StatusRefreshButton label="Refresh" />
          </div>

          <dl className="divide-y divide-stroke px-5 py-2 text-sm">
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">
                Invoice ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-ink">
                {invoiceId}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-4 py-3">
              <div>
                <dt className="text-xs font-semibold text-ink-soft">Created</dt>
                <dd
                  className="mt-1 text-sm font-semibold"
                  title={createdTimestamp.relative ?? undefined}
                >
                  {createdTimestamp.label}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-soft">Expires</dt>
                <dd
                  className="mt-1 text-sm font-semibold"
                  title={expiresTimestamp.relative ?? undefined}
                >
                  {expiresTimestamp.label}
                </dd>
              </div>
            </div>
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">
                Confirmations
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {confirmations}/{confirmationTarget}
              </dd>
            </div>
          </dl>

          <p className="border-t border-stroke bg-sand/50 px-5 py-4 text-xs leading-relaxed text-ink-soft">
            This status page is public. Anyone with the link can view the
            current invoice state.
          </p>
      {invoice.quote ? <div className="mt-4 rounded-xl border border-stroke p-4 text-sm">
        <p>Original reference: {invoice.quote.fiat_amount} {invoice.quote.fiat_currency}. This invoice is defined in XMR.</p>
        <p>Informational rate: {invoice.quote.rate} {invoice.quote.fiat_currency} per XMR. Source: {invoice.quote.source}. Quoted at: <Timestamp value={invoice.quote.quoted_at} />.</p>
        <p>This estimate does not lock a rate or guarantee a fiat outcome.</p>
      </div> : null}
        </aside>
      </div>

      <section
        className="mt-8 border-y border-stroke py-6"
        aria-labelledby="invoice-timeline"
      >
        <h2 className="text-xl font-semibold" id="invoice-timeline">
          Invoice timeline
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...timelineItems].reverse().map((item) => (
            <li className="border-l-2 border-sage pl-4" key={item.label}>
              <p className="text-xs font-semibold text-ink-soft">
                {item.label}
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                title={item.timestamp.relative ?? undefined}
              >
                {item.timestamp.label}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 flex flex-wrap gap-3">
        {checkoutContinueAvailable ? (
          <a
            className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
            href={`/api/core/public/invoice/${encodeURIComponent(invoiceId)}/continue`}
            rel="noreferrer"
          >
            Continue to merchant
          </a>
        ) : null}
        {invoice.payment_link_url ? <a href={invoice.payment_link_url} className="inline-flex min-h-11 items-center rounded-full border border-stroke px-5 py-3 font-semibold">Start another purchase</a> : null}
        <InvoiceStatusActions />
      </section>
    </main>
    </InvoiceStatusAutoRefresh>
  );
}
