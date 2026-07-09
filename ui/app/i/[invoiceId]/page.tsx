import type { Metadata } from "next";

import BtcpayModalBridge from "../../../components/btcpay-modal-bridge";
import BtcpayClassicCheckout from "../../../components/btcpay-classic-checkout";
import InvoicePaymentDetails from "../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh from "../../../components/invoice-status-auto-refresh";
import { formatRelativeTime } from "../../../components/relative-time";
import StatusRefreshButton from "../../../components/status-refresh-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Payment Request",
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
      className: "bg-amber-100 text-amber-900",
      label: "Wallet RPC unavailable",
    };
  }
  if (systemStatus.wallet_rpc === "ok") {
    return {
      className: "bg-emerald-100 text-emerald-900",
      label: "Wallet RPC ok",
    };
  }
  return {
    className: "bg-red-100 text-red-700",
    label: "Wallet RPC down",
  };
};

const daemonBadge = (systemStatus: SystemStatusResponse | null) => {
  if (!systemStatus) {
    return {
      className: "bg-amber-100 text-amber-900",
      label: "Daemon unavailable",
    };
  }
  if (systemStatus.daemon === "ok") {
    return {
      className: "bg-emerald-100 text-emerald-900",
      label: "Daemon connected",
    };
  }
  if (systemStatus.daemon === "unknown") {
    return {
      className: "bg-amber-100 text-amber-900",
      label: "Daemon not configured",
    };
  }
  return {
    className: "bg-red-100 text-red-700",
    label: "Daemon down",
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

const statusPillStyles: Record<InvoiceStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  payment_detected: "bg-emerald-100 text-emerald-900",
  confirmed: "bg-ink/20 text-ink",
  expired: "bg-red-100 text-red-700",
  invalid: "bg-clay/15 text-clay",
};

export default async function BtcpayModalInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const [response, systemStatusResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/api/core/public/invoice/${encodeURIComponent(invoiceId)}`, {
      cache: "no-store",
    }),
    fetch(`${apiBaseUrl}/api/core/public/system/status`, { cache: "no-store" }),
  ]);

  if (response.status === 404) {
    return (
      <main className="min-h-screen bg-cream px-6 py-6 text-ink">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-clay">
              Payment request
            </p>
            <h1 className="mt-2 font-sans font-semibold text-2xl">Invoice not found</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          The invoice id does not match a known invoice. Check the id and try
          again.
        </p>
      </main>
    );
  }

  if (!response.ok) {
    return (
      <main className="min-h-screen bg-cream px-6 py-6 text-ink">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-clay">
              Payment request
            </p>
            <h1 className="mt-2 font-sans font-semibold text-2xl">Status unavailable</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          We could not load this invoice status. Refresh the page or try again
          later.
        </p>
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
  const lastReconcileCompleted = formatTimestamp(systemStatus?.last_reconcile_completed_at ?? null);
  const walletStatusBadge = walletRpcBadge(systemStatus);
  const daemonStatusBadge = daemonBadge(systemStatus);
  const isBtcpayInvoice = Boolean(invoice.btcpay_amount && invoice.btcpay_currency);
  const useClassicCheckout =
    isBtcpayInvoice && invoice.btcpay_checkout_style === "btcpay_classic";
  const shouldShowBtcpayActions = isBtcpayInvoice && invoice.status === "confirmed";
  const checkoutContinueAvailable =
    !isBtcpayInvoice &&
    invoice.status === "confirmed" &&
    Boolean(invoice.checkout_continue_available);

  return (
    <main className="min-h-screen bg-cream px-6 py-6 text-ink">
      <InvoiceStatusAutoRefresh intervalMs={30000} />
      <BtcpayModalBridge invoiceId={invoiceId} status={invoice.status} />
      {useClassicCheckout ? (
        <div className="mx-auto grid max-w-md gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-clay">
                Payment request
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusRefreshButton label="Refresh" className="text-xs" />
            </div>
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
            redirectAutomatically={invoice.btcpay_redirect_automatically ?? null}
            orderId={invoice.btcpay_order_id ?? null}
            orderNumber={invoice.btcpay_order_number ?? null}
            qrLogoMode={invoice.qr_logo ?? "monero"}
            qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-clay">
                Payment request
              </p>
              <h1 className="mt-2 font-sans font-semibold text-2xl">Payment request</h1>
            </div>
            <div className="flex items-center gap-2">
              <StatusRefreshButton label="Refresh" className="text-xs" />
            </div>
          </div>

          <div className="mt-4">
            <InvoicePaymentDetails
              address={invoice.address}
              amount={invoice.amount_xmr}
              hasDetectedPayment={hasDetectedPayment}
              status={invoice.status}
              confirmationTarget={confirmationTarget}
              qrLogoMode={invoice.qr_logo ?? "monero"}
              qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-stroke bg-card p-5 shadow-card backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-ink/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink">
                Status
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${statusPillStyles[invoice.status]}`}
              >
                {statusLabel}
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  Confirmations
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {confirmations}/{confirmationTarget}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
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
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
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
            <div className="mt-4 rounded-xl border border-stroke bg-white/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  Monero node
                </p>
                <div className="flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em]">
                  <span
                    className={`rounded-full px-3 py-1 ${walletStatusBadge.className}`}
                  >
                    {walletStatusBadge.label}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 ${daemonStatusBadge.className}`}
                  >
                    {daemonStatusBadge.label}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Current block height
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {systemStatus?.daemon_height?.toLocaleString() ?? "Unavailable"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Detection poll
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {systemStatus?.invoice_reconcile_interval_seconds ?? 30}s
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Last successful scan
                  </p>
                  <p
                    className="mt-1 text-sm font-semibold"
                    title={lastReconcileCompleted.relative ?? undefined}
                  >
                    {lastReconcileCompleted.label}
                  </p>
                </div>
              </div>
              {systemStatus?.last_reconcile_error ? (
                <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">
                  Reconciler error: {systemStatus.last_reconcile_error}
                </p>
              ) : null}
            </div>
            {checkoutContinueAvailable ? (
              <a
                className="mt-5 inline-flex w-fit items-center justify-center rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:opacity-95"
                href={`/api/core/public/invoice/${encodeURIComponent(invoiceId)}/continue`}
                rel="noreferrer"
              >
                Continue to merchant
              </a>
            ) : null}
          </div>

          {shouldShowBtcpayActions ? (
            <div className="mt-6 grid gap-3">
              <a
                className="inline-flex items-center justify-center rounded-full bg-sage px-6 py-3 text-sm font-semibold text-cream shadow-[0_8px_16px_rgba(93,122,106,0.16)] transition hover:opacity-95"
                href={`/i/${encodeURIComponent(invoiceId)}/receipt`}
              >
                View receipt
              </a>
              {invoice.btcpay_redirect_url ? (
                <a
                  className="inline-flex items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-sage transition hover:bg-cream"
                  href={invoice.btcpay_redirect_url}
                  target="_top"
                  rel="noreferrer"
                >
                  Return to store
                </a>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
