import type { Metadata } from "next";

import InvoicePaymentDetails from "../../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh from "../../../../components/invoice-status-auto-refresh";
import InvoiceStatusActions from "../../../../components/invoice-status-actions";
import InvoiceStatusLookup from "../../../../components/invoice-status-lookup";
import PageIntroBand from "../../../../components/page-intro-band";
import { formatRelativeTime } from "../../../../components/relative-time";
import StatusBadge, {
  type StatusTone,
} from "../../../../components/status-badge";
import StatusRefreshButton from "../../../../components/status-refresh-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Payment Request",
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
  checkout_continue_available?: boolean;
  qr_logo?: "monero" | "none" | "custom" | null;
  qr_logo_data_url?: string | null;
  created_at: string;
  expires_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
};
type SystemStatusResponse = {
  wallet_rpc: "ok" | "unreachable";
  daemon: "ok" | "unreachable" | "unknown";
  reconciler: "ok" | "degraded" | "unavailable";
  daemon_height: number | null;
  invoice_reconcile_interval_seconds: number;
  last_reconcile_started_at: string | null;
  last_reconcile_completed_at: string | null;
  last_reconcile_error: string | null;
  last_reconcile_attempted_invoices: number;
  last_reconcile_succeeded_invoices: number;
  last_reconcile_failed_invoices: number;
};

const walletRpcBadge = (systemStatus: SystemStatusResponse | null) => {
  if (!systemStatus) {
    return {
      label: "Wallet RPC unavailable",
      tone: "pending" as StatusTone,
    };
  }
  if (systemStatus.wallet_rpc === "ok") {
    return {
      label: "Wallet RPC ok",
      tone: "success" as StatusTone,
    };
  }
  return {
    label: "Wallet RPC down",
    tone: "error" as StatusTone,
  };
};

const daemonBadge = (systemStatus: SystemStatusResponse | null) => {
  if (!systemStatus) {
    return {
      label: "Daemon unavailable",
      tone: "pending" as StatusTone,
    };
  }
  if (systemStatus.daemon === "ok") {
    return {
      label: "Daemon connected",
      tone: "success" as StatusTone,
    };
  }
  if (systemStatus.daemon === "unknown") {
    return {
      label: "Daemon not configured",
      tone: "pending" as StatusTone,
    };
  }
  return {
    label: "Daemon down",
    tone: "error" as StatusTone,
  };
};

const reconcilerBadge = (systemStatus: SystemStatusResponse | null) => {
  if (!systemStatus || systemStatus.reconciler === "unavailable") {
    return { label: "Detection unavailable", tone: "pending" as StatusTone };
  }
  if (systemStatus.reconciler === "ok") {
    return { label: "Detection healthy", tone: "success" as StatusTone };
  }
  return { label: "Detection degraded", tone: "error" as StatusTone };
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
    return "Waiting for a payment to be detected on-chain.";
  }
  if (status === "payment_detected") {
    return `Payment detected. ${confirmations}/${confirmationTarget} confirmations.`;
  }
  if (status === "confirmed") {
    return `Payment confirmed on-chain at ${confirmationTarget} confirmations.`;
  }
  if (status === "invalid") {
    return "Invoice marked invalid. Do not send payment.";
  }
  return "Invoice expired before detection. Create a new invoice if needed.";
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

export default async function InvoiceStatusDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const [response, systemStatusResponse] = await Promise.all([
    fetch(
      `${apiBaseUrl}/api/core/public/invoice/${encodeURIComponent(invoiceId)}`,
      {
        cache: "no-store",
      },
    ),
    fetch(`${apiBaseUrl}/api/core/public/system/status`, { cache: "no-store" }),
  ]);

  if (response.status === 404) {
    return (
      <main className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
        <PageIntroBand
          description="The invoice id does not match a known invoice. Check the id and try again."
          eyebrow="Invoice lookup"
          id="invoice-not-found"
          title="Invoice not found"
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
    );
  }

  const invoice = (await response.json()) as InvoiceStatusResponse;
  const systemStatus = systemStatusResponse.ok
    ? ((await systemStatusResponse.json()) as SystemStatusResponse)
    : null;
  const statusLabel = formatStatus(invoice.status);
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
  const lastReconcileCompleted = formatTimestamp(
    systemStatus?.last_reconcile_completed_at ?? null,
  );
  const walletStatusBadge = walletRpcBadge(systemStatus);
  const daemonStatusBadge = daemonBadge(systemStatus);
  const reconcilerStatusBadge = reconcilerBadge(systemStatus);

  return (
    <main className="mx-auto w-full max-w-7xl px-[6vw] pb-20 pt-10 text-ink">
      <InvoiceStatusAutoRefresh intervalMs={30000} />
      <PageIntroBand
        description={statusDescription(
          invoice.status,
          confirmationTarget,
          confirmations,
        )}
        eyebrow="Direct-to-wallet invoice"
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
        id="payment-request-title"
        title="Payment request"
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.65fr)] xl:items-start">
        <InvoicePaymentDetails
          address={invoice.address}
          amount={invoice.amount_xmr}
          hasDetectedPayment={hasDetectedPayment}
          status={invoice.status}
          confirmationTarget={confirmationTarget}
          qrLogoMode={invoice.qr_logo ?? "monero"}
          qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
        />

        <aside className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-stroke px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-ink-soft">
                Invoice context
              </p>
              <h2 className="mt-1 text-lg font-semibold">Detection details</h2>
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
                <dt className="text-xs font-semibold text-ink-soft">
                  Block height
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {systemStatus?.daemon_height?.toLocaleString() ??
                    "Unavailable"}
                </dd>
              </div>
            </div>
          </dl>

          <details className="border-t border-stroke px-5 py-4">
            <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
              Detection health
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={walletStatusBadge.label}
                  tone={walletStatusBadge.tone}
                />
                <StatusBadge
                  label={daemonStatusBadge.label}
                  tone={daemonStatusBadge.tone}
                />
                <StatusBadge
                  label={reconcilerStatusBadge.label}
                  tone={reconcilerStatusBadge.tone}
                />
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-ink-soft">
                    Detection poll
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {systemStatus?.invoice_reconcile_interval_seconds ?? 30}s
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-soft">
                    Last scan
                  </dt>
                  <dd
                    className="mt-1 font-semibold"
                    title={lastReconcileCompleted.relative ?? undefined}
                  >
                    {lastReconcileCompleted.label}
                  </dd>
                </div>
              </dl>
              {systemStatus?.last_reconcile_error ? (
                <p className="border-l-2 border-red-400 pl-3 text-sm text-red-700">
                  Detection error: {systemStatus.last_reconcile_error}
                </p>
              ) : null}
            </div>
          </details>

          <p className="border-t border-stroke bg-sand/50 px-5 py-4 text-xs leading-relaxed text-ink-soft">
            This status page is public. Anyone with the link can view the
            current invoice state.
          </p>
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
        <InvoiceStatusActions />
      </section>
    </main>
  );
}
