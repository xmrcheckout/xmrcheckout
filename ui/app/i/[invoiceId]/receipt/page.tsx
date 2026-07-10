import type { Metadata } from "next";
import { headers } from "next/headers";

import BtcpayModalBridge from "../../../../components/btcpay-modal-bridge";
import CopyIconButton from "../../../../components/copy-icon-button";
import PrintButton from "../../../../components/print-button";
import { formatRelativeTime } from "../../../../components/relative-time";
import StatusBadge, {
  type StatusTone,
} from "../../../../components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Receipt",
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

type InvoiceStatus =
  "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";

type InvoiceStatusResponse = {
  id: string;
  address: string;
  amount_xmr: string;
  amount_paid_xmr?: string | null;
  status: InvoiceStatus;
  confirmation_target: number;
  confirmations: number;
  created_at: string;
  confirmed_at: string | null;
  btcpay_amount?: string | null;
  btcpay_currency?: string | null;
  btcpay_redirect_url?: string | null;
  btcpay_order_id?: string | null;
  btcpay_order_number?: string | null;
  quote?: {
    fiat_amount: string;
    fiat_currency: string;
    rate: string;
    source: string;
    quoted_at: string;
  } | null;
  qr_url?: string | null;
};

const formatFiatAmount = (value: string, currency: string) => {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) {
    return `${value} ${currency}`;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const receiptTitle = (redirectUrl: string | null | undefined) => {
  if (!redirectUrl) {
    return "Receipt";
  }
  try {
    const parsed = new URL(redirectUrl);
    return parsed.hostname ? `${parsed.hostname}` : "Receipt";
  } catch {
    return "Receipt";
  }
};

const resolveQrSrc = (invoiceId: string, qrUrl: string | null | undefined) => {
  if (!qrUrl) {
    return `/qr/${encodeURIComponent(invoiceId)}.png`;
  }
  if (qrUrl.startsWith("/qr/")) {
    return qrUrl;
  }
  try {
    const parsed = new URL(qrUrl);
    if (parsed.pathname.startsWith("/qr/")) {
      return parsed.pathname;
    }
  } catch {
    // Ignore malformed URLs and fall back to the provided value.
  }
  return qrUrl;
};

const closeLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-stroke bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 print:hidden";

const statusLabels: Record<InvoiceStatus, string> = {
  pending: "Awaiting funds",
  payment_detected: "Payment detected",
  confirmed: "Confirmed",
  expired: "Expired",
  invalid: "Invalid",
};

const statusTones: Record<InvoiceStatus, StatusTone> = {
  pending: "pending",
  payment_detected: "detected",
  confirmed: "success",
  expired: "error",
  invalid: "error",
};

export default async function BtcpayReceiptPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedHost =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const response = await fetch(
    `${apiBaseUrl}/api/core/public/invoice/${encodeURIComponent(invoiceId)}`,
    {
      cache: "no-store",
      headers: {
        ...(forwardedProto ? { "x-forwarded-proto": forwardedProto } : {}),
        ...(forwardedHost ? { "x-forwarded-host": forwardedHost } : {}),
      },
    },
  );

  if (response.status === 404) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-4 py-10 text-ink">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <section className="w-full max-w-lg overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <header className="bg-ink px-6 py-5 text-cream">
            <p className="text-sm font-semibold text-cream/70">
              Payment receipt
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Invoice not found</h1>
          </header>
          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-ink-soft">
              The invoice id does not match a known invoice. Check the id and
              try again.
            </p>
            <div className="mt-5">
              <a
                className={closeLinkClassName}
                href={`/i/${encodeURIComponent(invoiceId)}`}
              >
                Close
              </a>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!response.ok) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-4 py-10 text-ink">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <section className="w-full max-w-lg overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <header className="bg-ink px-6 py-5 text-cream">
            <p className="text-sm font-semibold text-cream/70">
              Payment receipt
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Status unavailable</h1>
          </header>
          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-ink-soft">
              We could not load this invoice status. Refresh the page or try
              again later.
            </p>
            <div className="mt-5">
              <a
                className={closeLinkClassName}
                href={`/i/${encodeURIComponent(invoiceId)}`}
              >
                Close
              </a>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const invoice = (await response.json()) as InvoiceStatusResponse;
  const orderId =
    invoice.btcpay_order_number ?? invoice.btcpay_order_id ?? null;
  const receiptTimestamp = invoice.confirmed_at ?? invoice.created_at;
  const timestampLabel = new Date(receiptTimestamp).toLocaleString();
  const timestampRelative = formatRelativeTime(receiptTimestamp);
  const totalFiat =
    invoice.btcpay_amount &&
    invoice.btcpay_currency &&
    invoice.btcpay_currency !== "XMR"
      ? formatFiatAmount(invoice.btcpay_amount, invoice.btcpay_currency)
      : invoice.btcpay_amount && invoice.btcpay_currency
        ? `${invoice.btcpay_amount} ${invoice.btcpay_currency}`
        : null;
  const paidXmr = invoice.amount_paid_xmr ?? invoice.amount_xmr;
  const qrSrc = resolveQrSrc(invoiceId, invoice.qr_url);
  const storeTitle = receiptTitle(invoice.btcpay_redirect_url);
  const amountPaidLabel = totalFiat ? totalFiat : `${paidXmr} XMR`;
  const returnLabel = invoice.btcpay_redirect_url
    ? `Return to ${storeTitle}`
    : "Return to invoice";
  const returnHref =
    invoice.btcpay_redirect_url ?? `/i/${encodeURIComponent(invoiceId)}`;

  return (
    <main className="min-h-screen bg-cream px-3 py-6 text-ink print:bg-white print:p-0 sm:px-6 sm:py-10">
      <BtcpayModalBridge invoiceId={invoiceId} status={invoice.status} />
      <article className="mx-auto w-full max-w-3xl overflow-hidden rounded-surface border border-stroke bg-card shadow-card print:rounded-none print:border-neutral-300 print:bg-white print:shadow-none">
        <header className="bg-ink px-6 py-6 text-cream print:border-b print:border-neutral-300 print:bg-white print:text-black sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cream/70 print:text-neutral-600">
                Payment receipt
              </p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
                {storeTitle}
              </h1>
            </div>
            <StatusBadge
              label={statusLabels[invoice.status]}
              tone={statusTones[invoice.status]}
            />
          </div>
        </header>

        {invoice.status !== "confirmed" ? (
          <section className="px-6 py-10 text-center sm:px-8">
            {orderId ? (
              <p className="text-lg font-semibold">Order ID: {orderId}</p>
            ) : null}
            <p
              className="mt-2 text-sm text-ink-soft"
              title={timestampRelative ?? undefined}
            >
              {timestampLabel}
            </p>
            <p className="mx-auto mt-8 max-w-md border-l-2 border-clay pl-4 text-left text-sm leading-relaxed text-ink-soft">
              This receipt is available after the payment is confirmed.
            </p>
          </section>
        ) : (
          <>
            <section className="grid border-b border-stroke md:grid-cols-[280px_minmax(0,1fr)] print:grid-cols-[220px_minmax(0,1fr)]">
              <div className="grid place-items-center bg-sand/60 p-6 print:bg-white">
                <div className="border border-stroke bg-white p-3">
                  {qrSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt="Payment QR"
                      src={qrSrc}
                      className="h-52 w-52 print:h-44 print:w-44"
                    />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col justify-between px-6 py-7 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-ink-soft">
                      Amount paid
                    </p>
                    <p className="mt-1 break-words text-3xl font-semibold leading-tight">
                      {amountPaidLabel}
                    </p>
                  </div>
                  <PrintButton />
                </div>

                <dl className="mt-8 grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold text-ink-soft">
                      Date
                    </dt>
                    <dd
                      className="mt-1 text-sm font-semibold"
                      title={timestampRelative ?? undefined}
                    >
                      {timestampLabel}
                    </dd>
                  </div>
                  {orderId ? (
                    <div>
                      <dt className="text-xs font-semibold text-ink-soft">
                        Order ID
                      </dt>
                      <dd className="mt-1 break-words text-sm font-semibold">
                        {orderId}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </section>

            <section className="px-6 py-7 sm:px-8">
              <h2 className="text-xl font-semibold">Payment details</h2>

              <dl className="mt-5 grid divide-y divide-stroke border-y border-stroke text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="py-4 sm:px-4 sm:first:pl-0">
                  <dt className="text-xs font-semibold text-ink-soft">Date</dt>
                  <dd
                    className="mt-1 font-semibold"
                    title={timestampRelative ?? undefined}
                  >
                    {timestampLabel}
                  </dd>
                </div>
                <div className="py-4 sm:px-4">
                  <dt className="text-xs font-semibold text-ink-soft">
                    Reference total
                  </dt>
                  <dd className="mt-1 font-semibold">{totalFiat ?? "-"}</dd>
                </div>
                <div className="py-4 sm:px-4 sm:last:pr-0">
                  <dt className="text-xs font-semibold text-ink-soft">
                    Monero received
                  </dt>
                  <dd className="mt-1 font-semibold">{paidXmr} XMR</dd>
                </div>
              </dl>

              <div className="mt-6 text-sm">
                <p className="text-xs font-semibold text-ink-soft">
                  Destination
                </p>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="mt-2 min-w-0 flex-1 break-all bg-sand/60 px-3 py-3 font-mono text-xs leading-relaxed print:bg-white print:px-0">
                    {invoice.address}
                  </span>
                  <CopyIconButton
                    value={invoice.address}
                    label="Copy destination address"
                  />
                </div>
              </div>
            </section>

            <footer className="flex justify-center border-t border-stroke bg-sand/50 px-6 py-5 print:hidden">
              <a
                className="inline-flex items-center justify-center rounded-full bg-ink px-8 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                href={returnHref}
                target={invoice.btcpay_redirect_url ? "_top" : undefined}
                rel={invoice.btcpay_redirect_url ? "noreferrer" : undefined}
              >
                {returnLabel}
              </a>
            </footer>
          </>
        )}
      </article>
    </main>
  );
}
