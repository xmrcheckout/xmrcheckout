import type { Metadata } from "next";
import { headers } from "next/headers";

import BtcpayModalBridge from "../../../../components/btcpay-modal-bridge";
import CopyIconButton from "../../../../components/copy-icon-button";
import PrintButton from "../../../../components/print-button";
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
  "rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50";

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
  const paidXmr = invoice.amount_paid_xmr ?? invoice.amount_xmr;
  const qrSrc = resolveQrSrc(invoiceId, invoice.qr_url);
  const storeTitle = receiptTitle(invoice.btcpay_redirect_url);
  const amountPaidLabel = totalFiat ? totalFiat : `${paidXmr} XMR`;
  const returnLabel = invoice.btcpay_redirect_url ? `Return to ${storeTitle}` : "Return to invoice";
  const returnHref = invoice.btcpay_redirect_url ?? `/i/${encodeURIComponent(invoiceId)}`;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 text-neutral-900">
      <BtcpayModalBridge invoiceId={invoiceId} status={invoice.status} />
      <div className="mx-auto w-full max-w-4xl">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">{storeTitle}</h1>
        </header>

        {invoice.status !== "confirmed" ? (
          <div className="mt-6 text-center">
            {orderId ? <p className="mt-3 text-lg">Order ID: {orderId}</p> : null}
            <p className="mt-1 text-base text-neutral-600" title={timestampRelative ?? undefined}>
              {timestampLabel}
            </p>
            <p className="mt-10 text-sm text-neutral-600">
              This receipt is available after the payment is confirmed.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 rounded-xl bg-white p-6 shadow-soft">
              <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
                <div className="rounded-lg bg-neutral-100 p-4">
                  {qrSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="Payment QR" src={qrSrc} className="h-56 w-56" />
                  ) : null}
                </div>

                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="grid gap-5">
                    <div>
                      <p className="text-sm font-semibold text-neutral-500">Amount Paid</p>
                      <p className="mt-1 text-3xl font-semibold">{amountPaidLabel}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-500">Date</p>
                      <p className="mt-1 text-base" title={timestampRelative ?? undefined}>
                        {timestampLabel}
                      </p>
                    </div>
                    {orderId ? (
                      <div>
                        <p className="text-sm font-semibold text-neutral-500">Order ID</p>
                        <p className="mt-1 text-base">{orderId}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="md:self-start">
                    <PrintButton />
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-8 rounded-xl bg-white p-6 shadow-soft">
              <h2 className="text-xl font-semibold">Payment Details</h2>

              <div className="mt-6 text-sm text-neutral-500">
                <div className="grid grid-cols-3 gap-6 border-b border-neutral-200 pb-3">
                  <div>Date</div>
                  <div className="text-right">Paid</div>
                  <div className="text-right">Payment</div>
                </div>
                <div className="grid grid-cols-3 gap-6 pt-4 text-neutral-900">
                  <div title={timestampRelative ?? undefined}>{timestampLabel}</div>
                  <div className="text-right">{totalFiat ?? "-"}</div>
                  <div className="text-right">{paidXmr} XMR</div>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 text-sm md:flex-row md:items-center">
                <p className="font-semibold text-neutral-500 md:w-28">Destination</p>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs">
                    {invoice.address}
                  </span>
                  <CopyIconButton value={invoice.address} label="Copy destination address" />
                </div>
              </div>
            </section>

            <div className="mt-10 flex justify-center">
              <a
                className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-10 py-3 text-sm font-semibold text-emerald-700 shadow-soft transition hover:bg-emerald-50"
                href={returnHref}
                target={invoice.btcpay_redirect_url ? "_top" : undefined}
                rel={invoice.btcpay_redirect_url ? "noreferrer" : undefined}
              >
                {returnLabel}
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
