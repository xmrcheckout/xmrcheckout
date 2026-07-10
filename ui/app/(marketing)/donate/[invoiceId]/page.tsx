import type { Metadata } from "next";
import { notFound } from "next/navigation";

import InvoicePaymentDetails from "../../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh from "../../../../components/invoice-status-auto-refresh";
import DonationStatusActions from "../../../../components/donation-status-actions";
import InvoiceStatusLookup from "../../../../components/invoice-status-lookup";
import PageIntroBand from "../../../../components/page-intro-band";
import { formatRelativeTime } from "../../../../components/relative-time";
import StatusBadge, {
  type StatusTone,
} from "../../../../components/status-badge";
import StatusRefreshButton from "../../../../components/status-refresh-button";
import { areDonationsEnabled } from "../../../../lib/donations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Donation Request",
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

type InvoiceStatus =
  "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";

type InvoiceStatusResponse = {
  id: string;
  address: string;
  subaddress_index: number | null;
  amount_xmr: string;
  status: InvoiceStatus;
  confirmation_target: number;
  confirmations: number;
  created_at: string;
  expires_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
};

const formatStatus = (status: InvoiceStatus) => {
  if (status === "payment_detected") {
    return "Payment detected";
  }
  if (status === "pending") {
    return "Awaiting funds";
  }
  if (status === "confirmed") {
    return "Confirmed";
  }
  if (status === "invalid") {
    return "Invalid";
  }
  return "Expired";
};

const statusDescription = (
  status: InvoiceStatus,
  confirmationTarget: number,
  confirmations: number,
) => {
  if (status === "pending") {
    return "Awaiting on-chain detection of your donation.";
  }
  if (status === "payment_detected") {
    return `Donation detected. ${confirmations}/${confirmationTarget} confirmations.`;
  }
  if (status === "confirmed") {
    return `Donation confirmed on-chain at ${confirmationTarget} confirmations.`;
  }
  if (status === "invalid") {
    return "Donation marked invalid. Do not send a payment.";
  }
  return "Donation expired before detection. Start a new donation if needed.";
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

const statusTones: Record<InvoiceStatus, StatusTone> = {
  pending: "pending",
  payment_detected: "detected",
  confirmed: "success",
  expired: "error",
  invalid: "error",
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
  const response = await fetch(
    `${apiBaseUrl}/api/core/public/donation/${encodeURIComponent(invoiceId)}`,
    { cache: "no-store" },
  );

  if (response.status === 404) {
    return (
      <main className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
        <PageIntroBand
          description="The donation id does not match a known invoice. Check the id and try again."
          eyebrow="Donation lookup"
          id="donation-not-found"
          title="Donation invoice not found"
        />
        <section className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
          <h2 className="text-lg font-semibold">Check another invoice</h2>
          <div className="mt-4 max-w-2xl">
            <InvoiceStatusLookup initialValue={invoiceId} compact />
          </div>
        </section>
      </main>
    );
  }

  if (!response.ok) {
    return (
      <main className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
        <PageIntroBand
          description="We could not load this donation status. Refresh the page or try again later."
          eyebrow="Donation lookup"
          id="donation-unavailable"
          title="Status unavailable"
        />
        <section className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
          <h2 className="text-lg font-semibold">Try the lookup again</h2>
          <div className="mt-4 max-w-2xl">
            <InvoiceStatusLookup initialValue={invoiceId} compact />
          </div>
        </section>
      </main>
    );
  }

  const invoice = (await response.json()) as InvoiceStatusResponse;
  const statusLabel = formatStatus(invoice.status);
  const confirmations = Math.max(0, invoice.confirmations ?? 0);
  const confirmationTarget = Math.max(0, invoice.confirmation_target);
  const hasDetectedPayment =
    invoice.status === "payment_detected" || invoice.status === "confirmed";
  const timelineItems: {
    label: string;
    timestamp: ReturnType<typeof formatTimestamp>;
    state: "complete";
  }[] = [];

  timelineItems.push({
    label: "Donation created",
    timestamp: formatTimestamp(invoice.created_at),
    state: "complete",
  });

  if (invoice.detected_at) {
    timelineItems.push({
      label: "Donation detected",
      timestamp: formatTimestamp(invoice.detected_at),
      state: "complete",
    });
  }

  if (invoice.confirmed_at) {
    timelineItems.push({
      label: "Donation confirmed",
      timestamp: formatTimestamp(invoice.confirmed_at),
      state: "complete",
    });
  }

  if (invoice.status === "expired") {
    timelineItems.push({
      label: "Donation expired",
      timestamp: formatTimestamp(invoice.expires_at),
      state: "complete",
    });
  }

  const createdTimestamp = formatTimestamp(invoice.created_at);
  const expiresTimestamp = formatTimestamp(invoice.expires_at);

  return (
    <main className="mx-auto w-full max-w-7xl px-[6vw] pb-20 pt-10 text-ink">
      <InvoiceStatusAutoRefresh intervalMs={30000} />
      <PageIntroBand
        description={statusDescription(
          invoice.status,
          confirmationTarget,
          confirmations,
        )}
        eyebrow="Direct-to-wallet donation"
        facts={[
          {
            label: "Current status",
            value: (
              <StatusBadge
                label={statusLabel}
                tone={statusTones[invoice.status]}
              />
            ),
          },
          {
            label: "Confirmations",
            value: `${confirmations}/${confirmationTarget}`,
          },
          {
            label: "Expires",
            value: expiresTimestamp.label,
          },
        ]}
        id="donation-request-title"
        title="Make a donation"
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.65fr)] xl:items-start">
        <InvoicePaymentDetails
          address={invoice.address}
          amount={invoice.amount_xmr}
          hasDetectedPayment={hasDetectedPayment}
          status={invoice.status}
          confirmationTarget={confirmationTarget}
        />

        <aside className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-stroke px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-ink-soft">
                Donation context
              </p>
              <h2 className="mt-1 text-lg font-semibold">Request details</h2>
            </div>
            <StatusRefreshButton label="Refresh" />
          </div>
          <dl className="divide-y divide-stroke px-5 py-2 text-sm">
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">
                Donation ID
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
          </dl>
          <p className="border-t border-stroke bg-sand/50 px-5 py-4 text-xs leading-relaxed text-ink-soft">
            This status page is public. Anyone with the link can view the
            current donation state.
          </p>
        </aside>
      </div>

      <section
        className="mt-8 border-y border-stroke py-6"
        aria-labelledby="donation-timeline"
      >
        <h2 className="text-xl font-semibold" id="donation-timeline">
          Donation timeline
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
        <DonationStatusActions />
      </section>
    </main>
  );
}
