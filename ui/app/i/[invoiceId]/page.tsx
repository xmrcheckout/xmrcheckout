import type { Metadata } from "next";

import BtcpayModalBridge from "../../../components/btcpay-modal-bridge";
import BtcpayClassicCheckout from "../../../components/btcpay-classic-checkout";
import InvoicePaymentDetails from "../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh from "../../../components/invoice-status-auto-refresh";
import { formatRelativeTime } from "../../../components/relative-time";
import StatusBadge, { type StatusTone } from "../../../components/status-badge";
import StatusRefreshButton from "../../../components/status-refresh-button";

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
  amount_paid_xmr?: string | null;
  status: InvoiceStatus;
  confirmation_target: number;
  confirmations: number;
  checkout_continue_available?: boolean;
  created_at: string;
  expires_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
  btcpay_amount?: string | null;
  btcpay_currency?: string | null;
  btcpay_checkout_style?: "standard" | "btcpay_classic" | null;
  btcpay_redirect_url?: string | null;
  btcpay_redirect_automatically?: boolean | null;
  btcpay_order_id?: string | null;
  btcpay_order_number?: string | null;
  qr_logo?: "monero" | "none" | "custom" | null;
  qr_logo_data_url?: string | null;
  quote?: {
    fiat_amount: string;
    fiat_currency: string;
    rate: string;
    source: string;
    quoted_at: string;
  } | null;
};
type SystemStatusResponse = {
  wallet_rpc: "ok" | "unreachable";
  daemon: "ok" | "unreachable" | "unknown";
  daemon_height: number | null;
  invoice_reconcile_interval_seconds: number;
  last_reconcile_started_at: string | null;
  last_reconcile_completed_at: string | null;
  last_reconcile_error: string | null;
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

export default async function BtcpayModalInvoicePage({
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
      <main className="grid min-h-screen place-items-center bg-cream px-3 py-6 text-ink sm:px-6">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <section className="w-full max-w-lg overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <header className="bg-ink px-6 py-5 text-cream">
            <p className="flex items-center gap-2 text-sm font-semibold text-cream/70">
              <span
                className="h-2.5 w-2.5 rounded-full bg-monero"
                aria-hidden="true"
              />
              Direct-to-wallet checkout
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Invoice not found</h1>
          </header>
          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-ink-soft">
              The invoice id does not match a known invoice. Check the id and
              try again.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!response.ok) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-3 py-6 text-ink sm:px-6">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <section className="w-full max-w-lg overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <header className="bg-ink px-6 py-5 text-cream">
            <p className="flex items-center gap-2 text-sm font-semibold text-cream/70">
              <span
                className="h-2.5 w-2.5 rounded-full bg-monero"
                aria-hidden="true"
              />
              Direct-to-wallet checkout
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Status unavailable</h1>
          </header>
          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-ink-soft">
              We could not load this invoice status. Refresh the page or try
              again later.
            </p>
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
  const createdTimestamp = formatTimestamp(invoice.created_at);
  const expiresTimestamp = formatTimestamp(invoice.expires_at);
  const lastReconcileCompleted = formatTimestamp(
    systemStatus?.last_reconcile_completed_at ?? null,
  );
  const walletStatusBadge = walletRpcBadge(systemStatus);
  const daemonStatusBadge = daemonBadge(systemStatus);
  const isBtcpayInvoice = Boolean(
    invoice.btcpay_amount && invoice.btcpay_currency,
  );
  const useClassicCheckout =
    isBtcpayInvoice && invoice.btcpay_checkout_style === "btcpay_classic";
  const shouldShowBtcpayActions =
    isBtcpayInvoice && invoice.status === "confirmed";
  const checkoutContinueAvailable =
    !isBtcpayInvoice &&
    invoice.status === "confirmed" &&
    Boolean(invoice.checkout_continue_available);

  return (
    <main className="min-h-screen bg-cream px-3 py-4 text-ink sm:px-6 sm:py-6">
      <InvoiceStatusAutoRefresh intervalMs={30000} />
      <BtcpayModalBridge invoiceId={invoiceId} status={invoice.status} />
      {useClassicCheckout ? (
        <div className="mx-auto grid max-w-md gap-5">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="h-2.5 w-2.5 rounded-full bg-monero"
                aria-hidden="true"
              />
              Direct-to-wallet checkout
            </p>
            <StatusRefreshButton label="Refresh" />
          </div>
          <BtcpayClassicCheckout
            invoiceId={invoiceId}
            address={invoice.address}
            amountXmr={invoice.amount_xmr}
            amountPaidXmr={invoice.amount_paid_xmr ?? null}
            btcpayAmount={invoice.btcpay_amount ?? null}
            btcpayCurrency={invoice.btcpay_currency ?? null}
            quote={invoice.quote ?? null}
            status={invoice.status}
            confirmationTarget={confirmationTarget}
            redirectUrl={invoice.btcpay_redirect_url ?? null}
            redirectAutomatically={
              invoice.btcpay_redirect_automatically ?? null
            }
            orderId={invoice.btcpay_order_id ?? null}
            orderNumber={invoice.btcpay_order_number ?? null}
            qrLogoMode={invoice.qr_logo ?? "monero"}
            qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="h-2.5 w-2.5 rounded-full bg-monero"
                aria-hidden="true"
              />
              Direct-to-wallet checkout
            </p>
            <StatusRefreshButton label="Refresh" />
          </div>

          <InvoicePaymentDetails
            address={invoice.address}
            amount={invoice.amount_xmr}
            hasDetectedPayment={hasDetectedPayment}
            status={invoice.status}
            confirmationTarget={confirmationTarget}
            qrLogoMode={invoice.qr_logo ?? "monero"}
            qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
          />

          <section className="mt-4 overflow-hidden rounded-surface border border-stroke bg-card shadow-soft">
            <div className="grid divide-y divide-stroke sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-ink-soft">Status</p>
                <StatusBadge
                  className="mt-2"
                  label={statusLabel}
                  tone={statusTones[invoice.status]}
                />
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-ink-soft">
                  Confirmations
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {confirmations}/{confirmationTarget}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-ink-soft">Expires</p>
                <p
                  className="mt-2 text-sm font-semibold"
                  title={expiresTimestamp.relative ?? undefined}
                >
                  {expiresTimestamp.label}
                </p>
              </div>
            </div>
            <details className="border-t border-stroke px-5 py-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
                Detection details
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
                </div>
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold text-ink-soft">
                      Block height
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {systemStatus?.daemon_height?.toLocaleString() ??
                        "Unavailable"}
                    </dd>
                  </div>
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
                <p
                  className="text-xs text-ink-soft"
                  title={createdTimestamp.relative ?? undefined}
                >
                  Created {createdTimestamp.label}
                </p>
              </div>
            </details>
            {checkoutContinueAvailable ? (
              <div className="border-t border-stroke bg-sand/50 px-5 py-4">
                <a
                  className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                  href={`/api/core/public/invoice/${encodeURIComponent(invoiceId)}/continue`}
                  rel="noreferrer"
                >
                  Continue to merchant
                </a>
              </div>
            ) : null}
          </section>

          {shouldShowBtcpayActions ? (
            <div className="mt-6 grid gap-3">
              <a
                className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                href={`/i/${encodeURIComponent(invoiceId)}/receipt`}
              >
                View receipt
              </a>
              {invoice.btcpay_redirect_url ? (
                <a
                  className="inline-flex items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                  href={invoice.btcpay_redirect_url}
                  target="_top"
                  rel="noreferrer"
                >
                  Return to store
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
