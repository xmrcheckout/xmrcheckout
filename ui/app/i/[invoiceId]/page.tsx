import type { Metadata } from "next";

import BtcpayModalBridge from "../../../components/btcpay-modal-bridge";
import BtcpayModalCloseButton from "../../../components/btcpay-modal-close-button";
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
  status: InvoiceStatus;
  confirmation_target: number;
  confirmations: number;
  created_at: string;
  expires_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
  btcpay_amount?: string | null;
  btcpay_currency?: string | null;
  btcpay_checkout_style?: "standard" | "btcpay_classic" | null;
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
  const response = await fetch(
    `${apiBaseUrl}/api/core/public/invoice/${encodeURIComponent(invoiceId)}`,
    { cache: "no-store" }
  );

  if (response.status === 404) {
    return (
      <main className="min-h-screen bg-cream px-6 py-6 text-ink">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
              Payment request
            </p>
            <h1 className="mt-2 font-serif text-2xl">Invoice not found</h1>
          </div>
          <BtcpayModalCloseButton />
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
              Payment request
            </p>
            <h1 className="mt-2 font-serif text-2xl">Status unavailable</h1>
          </div>
          <BtcpayModalCloseButton />
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          We could not load this invoice status. Refresh the page or try again
          later.
        </p>
      </main>
    );
  }

  const invoice = (await response.json()) as InvoiceStatusResponse;
  const statusLabel = formatStatus(invoice.status);
  const confirmations = Math.max(0, invoice.confirmations ?? 0);
  const confirmationTarget = Math.max(0, invoice.confirmation_target);
  const hasDetectedPayment =
    invoice.status === "payment_detected" || invoice.status === "confirmed";
  const createdTimestamp = formatTimestamp(invoice.created_at);
  const expiresTimestamp = formatTimestamp(invoice.expires_at);
  const isBtcpayInvoice = Boolean(invoice.btcpay_amount && invoice.btcpay_currency);
  const useClassicCheckout =
    isBtcpayInvoice && invoice.btcpay_checkout_style === "btcpay_classic";

  return (
    <main className="min-h-screen bg-cream px-6 py-6 text-ink">
      <InvoiceStatusAutoRefresh intervalMs={30000} />
      <BtcpayModalBridge invoiceId={invoiceId} status={invoice.status} />
      {useClassicCheckout ? (
        <div className="mx-auto grid max-w-md gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
                Payment request
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusRefreshButton label="Refresh" className="text-xs" />
              <BtcpayModalCloseButton />
            </div>
          </div>
          <BtcpayClassicCheckout
            address={invoice.address}
            amountXmr={invoice.amount_xmr}
            btcpayAmount={invoice.btcpay_amount ?? null}
            btcpayCurrency={invoice.btcpay_currency ?? null}
            quote={invoice.quote ?? null}
            status={invoice.status}
            confirmationTarget={confirmationTarget}
            qrLogoMode={invoice.qr_logo ?? "monero"}
            qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
                Payment request
              </p>
              <h1 className="mt-2 font-serif text-2xl">Payment request</h1>
            </div>
            <div className="flex items-center gap-2">
              <StatusRefreshButton label="Refresh" className="text-xs" />
              <BtcpayModalCloseButton />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-stroke bg-card p-5 shadow-card backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-ink/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink">
                Status
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${statusPillStyles[invoice.status]}`}
              >
                {statusLabel}
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
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

          <div className="mt-5">
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
        </>
      )}
    </main>
  );
}
