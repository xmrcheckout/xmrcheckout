import type { Metadata } from "next";
import { headers } from "next/headers";

import BtcpayModalBridge from "../../../../components/btcpay-modal-bridge";
import { formatRelativeTime } from "../../../../components/relative-time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Receipt",
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
  "rounded-full border border-stroke bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:bg-white";

export default async function BtcpayReceiptPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const response = await fetch(
    `${apiBaseUrl}/api/core/public/invoice/${encodeURIComponent(invoiceId)}`,
    {
      cache: "no-store",
      headers: {
        ...(forwardedProto ? { "x-forwarded-proto": forwardedProto } : {}),
        ...(forwardedHost ? { "x-forwarded-host": forwardedHost } : {}),
      },
    }
  );

  if (response.status === 404) {
    return (
      <main className="min-h-screen bg-white px-4 py-10 text-ink">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex justify-end">
            <a className={closeLinkClassName} href={`/i/${encodeURIComponent(invoiceId)}`}>
              Close
            </a>
          </div>
          <div className="mt-6 text-center">
            <h1 className="text-3xl font-semibold">Invoice not found</h1>
            <p className="mt-3 text-sm text-ink-soft">
              The invoice id does not match a known invoice. Check the id and try again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!response.ok) {
    return (
      <main className="min-h-screen bg-white px-4 py-10 text-ink">
        <BtcpayModalBridge invoiceId={invoiceId} status="invalid" />
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex justify-end">
            <a className={closeLinkClassName} href={`/i/${encodeURIComponent(invoiceId)}`}>
              Close
            </a>
          </div>
          <div className="mt-6 text-center">
            <h1 className="text-3xl font-semibold">Status unavailable</h1>
            <p className="mt-3 text-sm text-ink-soft">
              We could not load this invoice status. Refresh the page or try again later.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const invoice = (await response.json()) as InvoiceStatusResponse;
  const orderId = invoice.btcpay_order_number ?? invoice.btcpay_order_id ?? null;
  const receiptTimestamp = invoice.confirmed_at ?? invoice.created_at;
  const timestampLabel = new Date(receiptTimestamp).toLocaleString();
  const timestampRelative = formatRelativeTime(receiptTimestamp);
  const totalFiat =
    invoice.btcpay_amount && invoice.btcpay_currency && invoice.btcpay_currency !== "XMR"
      ? formatFiatAmount(invoice.btcpay_amount, invoice.btcpay_currency)
      : invoice.btcpay_amount && invoice.btcpay_currency
        ? `${invoice.btcpay_amount} ${invoice.btcpay_currency}`
        : null;
  const exchangeRate =
    invoice.quote?.rate && invoice.quote.fiat_currency
      ? formatFiatAmount(invoice.quote.rate, invoice.quote.fiat_currency)
      : null;
  const paidXmr = invoice.amount_paid_xmr ?? invoice.amount_xmr;
  const qrSrc = resolveQrSrc(invoiceId, invoice.qr_url);
  const storeTitle = receiptTitle(invoice.btcpay_redirect_url);

  return (
    <main className="min-h-screen bg-white px-4 py-10 text-ink">
      <BtcpayModalBridge invoiceId={invoiceId} status={invoice.status} />
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex justify-end">
          <a className={closeLinkClassName} href={`/i/${encodeURIComponent(invoiceId)}`}>
            Close
          </a>
        </div>

        {invoice.status !== "confirmed" ? (
          <div className="mt-6 text-center">
            <h1 className="text-4xl font-semibold tracking-tight">{storeTitle}</h1>
            {orderId ? <p className="mt-3 text-lg text-ink">Order ID: {orderId}</p> : null}
            <p className="mt-1 text-base text-ink-soft" title={timestampRelative ?? undefined}>
              {timestampLabel}
            </p>
            <p className="mt-10 text-sm text-ink-soft">
              This receipt is available after the payment is confirmed.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 text-center">
              <h1 className="text-4xl font-semibold tracking-tight">{storeTitle}</h1>
              {orderId ? <p className="mt-3 text-lg text-ink">Order ID: {orderId}</p> : null}
              <p className="mt-1 text-base text-ink-soft" title={timestampRelative ?? undefined}>
                {timestampLabel}
              </p>
            </div>

            <div className="mt-10 border-y border-stroke">
              <dl className="text-base">
                <div className="flex items-center justify-between gap-6 py-5">
                  <dt className="text-ink-soft">Total</dt>
                  <dd className="text-right font-medium">{totalFiat ?? "-"}</dd>
                </div>
                <div className="flex items-start justify-between gap-6 border-t border-stroke py-5">
                  <dt className="pt-0.5 text-ink-soft">Paid</dt>
                  <dd className="text-right">
                    <div className="font-medium">{paidXmr} XMR</div>
                    {totalFiat ? <div className="mt-2 text-ink-soft">{totalFiat}</div> : null}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6 border-t border-stroke py-5">
                  <dt className="text-ink-soft">Rate</dt>
                  <dd className="text-right font-medium">{exchangeRate ?? "-"}</dd>
                </div>
                <div className="flex items-center gap-6 border-t border-stroke py-5">
                  <dt className="w-28 flex-none text-ink-soft sm:w-36">Destination</dt>
                  <dd className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
                    {invoice.address}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-10 flex justify-center">
              {qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Payment QR"
                  src={qrSrc}
                  className="h-64 w-64 bg-white p-2 sm:h-72 sm:w-72"
                />
              ) : null}
            </div>

            <p className="mt-10 text-center text-sm text-ink-soft">
              Powered by XMR Checkout
            </p>
          </>
        )}
      </div>
    </main>
  );
}
