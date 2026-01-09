import type { Metadata } from "next";
import { notFound } from "next/navigation";

import InvoicePaymentDetails from "../../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh from "../../../../components/invoice-status-auto-refresh";
import DonationStatusActions from "../../../../components/donation-status-actions";
import InvoiceStatusLookup from "../../../../components/invoice-status-lookup";
import { formatRelativeTime } from "../../../../components/relative-time";
import StatusRefreshButton from "../../../../components/status-refresh-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Donation Request",
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

type InvoiceStatus =
  | "pending"
  | "payment_detected"
  | "confirmed"
  | "expired"
  | "invalid";

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
  confirmations: number
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

const statusPillStyles: Record<InvoiceStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  payment_detected: "bg-emerald-100 text-emerald-900",
  confirmed: "bg-ink/20 text-ink",
  expired: "bg-red-100 text-red-700",
  invalid: "bg-clay/15 text-clay",
};

export default async function DonateStatusDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const donationsEnabled = process.env.NEXT_PUBLIC_DONATIONS_ENABLED === "true";
  if (!donationsEnabled) {
    notFound();
  }
  const { invoiceId } = await params;
  const response = await fetch(
    `${apiBaseUrl}/api/core/public/donation/${encodeURIComponent(invoiceId)}`,
    { cache: "no-store" }
  );

  if (response.status === 404) {
    return (
      <main className="px-[6vw] pb-20 pt-10 text-ink">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="grid gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
              Donation status
            </p>
            <h1 className="font-serif text-[clamp(2.2rem,2rem+1.4vw,3.4rem)] leading-[1.1]">
              Donation invoice not found.
            </h1>
            <p className="text-[1.05rem] leading-relaxed text-ink-soft">
              The donation id does not match a known invoice. Check the id and
              try again.
            </p>
          </div>
          <div className="rounded-2xl border border-stroke bg-card p-7 shadow-card backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">
              Need another lookup?
            </p>
            <div className="mt-4">
              <InvoiceStatusLookup initialValue={invoiceId} compact />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!response.ok) {
    return (
      <main className="px-[6vw] pb-20 pt-10 text-ink">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="grid gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
              Donation status
            </p>
            <h1 className="font-serif text-[clamp(2.2rem,2rem+1.4vw,3.4rem)] leading-[1.1]">
              Status unavailable.
            </h1>
            <p className="text-[1.05rem] leading-relaxed text-ink-soft">
              We could not load this donation status. Refresh the page or try
              again later.
            </p>
          </div>
          <div className="rounded-2xl border border-stroke bg-card p-7 shadow-card backdrop-blur">
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
  const isInvalid = invoice.status === "invalid";
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

  const showConfirmedStamp = invoice.status === "confirmed";
  const createdTimestamp = formatTimestamp(invoice.created_at);
  const expiresTimestamp = formatTimestamp(invoice.expires_at);

  return (
    <main className="px-[6vw] pb-20 pt-10 text-ink">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <InvoiceStatusAutoRefresh intervalMs={30000} />
        <div className="grid gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
            Make a donation
          </p>
          <h1 className="font-serif text-[clamp(2.2rem,2rem+1.4vw,3.4rem)] leading-[1.1]">
            Make a donation
          </h1>
          <p className="text-[1.05rem] leading-relaxed text-ink-soft">
            {isInvalid
              ? "This donation is marked invalid. Do not pay."
              : "Send the exact amount shown below to donate."}
          </p>
          <p className="text-[1.05rem] leading-relaxed text-ink-soft">
            {statusDescription(invoice.status, confirmationTarget, confirmations)}
          </p>
          <details className="rounded-xl border border-stroke bg-white/60 px-4 py-3 text-sm text-ink-soft shadow-soft">
            <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.18em] text-ink">
              Details
            </summary>
            <div className="mt-3 grid gap-2">
              <p className="font-mono text-xs text-ink">Donation ID: {invoiceId}</p>
              <p>This status page is public. Anyone with the link can view the current state.</p>
            </div>
          </details>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-stroke bg-card p-7 shadow-card backdrop-blur">
          {showConfirmedStamp ? (
            <div
              className="pointer-events-none absolute left-1/2 top-4 z-10 grid h-20 w-20 -translate-x-1/2 -rotate-[12deg] place-items-center rounded-full border-2 border-emerald-700 bg-cream/80 text-center text-[0.55rem] font-bold uppercase tracking-[0.2em] text-emerald-800 shadow-[0_10px_20px_rgba(16,18,23,0.18)]"
              aria-hidden="true"
            >
              <span className="leading-tight">Payment confirmed</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-ink/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink">
              Status
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${statusPillStyles[invoice.status]}`}
              >
                {statusLabel}
              </span>
              <StatusRefreshButton label="Refresh" />
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Confirmations
              </p>
              <p className="mt-1 text-lg font-semibold">
                {confirmations}/{confirmationTarget}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Created
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                title={createdTimestamp.relative ?? undefined}
              >
                {createdTimestamp.label}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Expires
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                title={expiresTimestamp.relative ?? undefined}
              >
                {expiresTimestamp.label}
              </p>
            </div>
          </div>
        </div>
      </section>

      <InvoicePaymentDetails
        address={invoice.address}
        amount={invoice.amount_xmr}
        hasDetectedPayment={hasDetectedPayment}
        status={invoice.status}
        confirmationTarget={confirmationTarget}
      />

      <section className="mt-8 rounded-2xl border border-stroke bg-card p-7 shadow-card backdrop-blur">
        <h2 className="font-serif text-2xl">Timeline</h2>
        <ol className="mt-5 grid gap-3">
          {[...timelineItems].reverse().map((item) => (
            <li
              className="flex items-center justify-between gap-6 rounded-xl border border-ink/20 bg-white/70 px-4 py-3"
              key={item.label}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  {item.label}
                </p>
                <p
                  className="mt-1 text-sm font-semibold"
                  title={item.timestamp.relative ?? undefined}
                >
                  {item.timestamp.label}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 grid gap-4">
        <DonationStatusActions />
      </section>
    </main>
  );
}
