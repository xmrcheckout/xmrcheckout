"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import CopyIconButton from "./copy-icon-button";
import StatusBadge, { type StatusTone } from "./status-badge";
import { formatXmrAmount } from "../lib/formatting";

type InvoiceStatus =
  "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";

type QuotePayload = {
  fiat_amount: string;
  fiat_currency: string;
  rate: string;
  source: string;
  quoted_at: string;
};

type BtcpayClassicCheckoutProps = {
  invoiceId: string;
  address: string;
  amountXmr: string;
  amountPaidXmr: string | null;
  btcpayAmount: string | null;
  btcpayCurrency: string | null;
  quote: QuotePayload | null;
  status: InvoiceStatus;
  confirmationTarget: number;
  redirectUrl: string | null;
  redirectAutomatically: boolean | null;
  orderId: string | null;
  orderNumber: string | null;
  qrLogoMode?: "monero" | "none" | "custom" | null;
  qrLogoDataUrl?: string | null;
};

const buildMoneroUri = (address: string, amount: string) => {
  const params = new URLSearchParams();
  params.set("tx_amount", amount);
  return `monero:${address}?${params.toString()}`;
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

const formatReturnLabel = (redirectUrl: string) => {
  try {
    const parsed = new URL(redirectUrl);
    return parsed.hostname ? `Return to ${parsed.hostname}` : "Return to store";
  } catch {
    return "Return to store";
  }
};

const statusMessage = (
  status: InvoiceStatus,
  confirmationTarget: number,
): string => {
  if (status === "invalid") {
    return "Invoice marked invalid. Do not send payment.";
  }
  if (status === "expired") {
    return "Invoice expired. Do not send payment.";
  }
  if (status === "confirmed") {
    return `Payment confirmed at ${confirmationTarget} confirmations.`;
  }
  if (status === "payment_detected") {
    return "Payment detected. Awaiting confirmations.";
  }
  return "Awaiting funds.";
};

export default function BtcpayClassicCheckout({
  invoiceId,
  address,
  amountXmr,
  amountPaidXmr,
  btcpayAmount,
  btcpayCurrency,
  quote,
  status,
  confirmationTarget,
  redirectUrl,
  redirectAutomatically,
  orderId,
  orderNumber,
  qrLogoMode,
  qrLogoDataUrl,
}: BtcpayClassicCheckoutProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const formattedAmount = useMemo(
    () => formatXmrAmount(amountXmr),
    [amountXmr],
  );
  const formattedPaidAmount = useMemo(() => {
    if (!amountPaidXmr) {
      return formattedAmount;
    }
    return formatXmrAmount(amountPaidXmr);
  }, [amountPaidXmr, formattedAmount]);
  const uri = useMemo(
    () => buildMoneroUri(address, formattedAmount),
    [address, formattedAmount],
  );
  const totalFiat =
    btcpayAmount && btcpayCurrency && btcpayCurrency !== "XMR"
      ? formatFiatAmount(btcpayAmount, btcpayCurrency)
      : null;
  const exchangeRate =
    quote?.rate && quote.fiat_currency
      ? `1 XMR = ${formatFiatAmount(quote.rate, quote.fiat_currency)}`
      : null;

  useEffect(() => {
    if (status !== "confirmed" || !redirectUrl || !redirectAutomatically) {
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        window.top?.location.assign(redirectUrl);
      } catch {
        window.location.assign(redirectUrl);
      }
    }, 3000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [redirectAutomatically, redirectUrl, status]);

  useEffect(() => {
    let active = true;
    const size = 260;
    const canvas = document.createElement("canvas");
    QRCode.toCanvas(canvas, uri, {
      margin: 1,
      width: size,
      errorCorrectionLevel: "H",
    })
      .then(() => {
        const context = canvas.getContext("2d");
        if (!context) {
          return null;
        }
        const mode = qrLogoMode ?? "monero";
        const wantsLogo = mode !== "none";
        if (wantsLogo) {
          const blankSize = Math.round(size * 0.28);
          const blankOffset = Math.round((size - blankSize) / 2);
          context.fillStyle = "#ffffff";
          context.fillRect(blankOffset, blankOffset, blankSize, blankSize);
        }
        return canvas.toDataURL();
      })
      .then((url) => {
        if (active) {
          setQrDataUrl(url ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl(null);
        }
      });
    return () => {
      active = false;
    };
  }, [uri, qrLogoMode]);

  const canSendPayment = status === "pending";
  const resolvedQrLogoMode = qrLogoMode ?? "monero";
  const resolvedLogoSrc =
    resolvedQrLogoMode === "custom"
      ? qrLogoDataUrl
      : resolvedQrLogoMode === "monero"
        ? "/monero-logo.svg"
        : null;
  const statusTone: StatusTone =
    status === "pending"
      ? "pending"
      : status === "payment_detected"
        ? "detected"
        : status === "confirmed"
          ? "success"
          : "error";
  const statusLabel =
    status === "pending"
      ? "Awaiting funds"
      : status === "payment_detected"
        ? "Payment detected"
        : status === "confirmed"
          ? "Confirmed"
          : status === "expired"
            ? "Expired"
            : "Invalid";

  if (status === "confirmed") {
    return (
      <section className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
        <header className="bg-ink px-6 py-7 text-center text-cream">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage text-cream">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-9 w-9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-cream/70">
            Payment request
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Payment confirmed</h2>
          <StatusBadge className="mt-4" label="Confirmed" tone="success" />
        </header>

        <dl className="divide-y divide-stroke px-6 py-3 text-sm text-ink">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">Invoice id</dt>
            <dd className="max-w-[60%] truncate text-right font-semibold">
              {invoiceId}
            </dd>
          </div>
          {orderNumber || orderId ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-ink-soft">Order id</dt>
              <dd className="font-semibold">{orderNumber ?? orderId}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">Total price</dt>
            <dd className="font-semibold">{formattedAmount} XMR</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">Total fiat</dt>
            <dd className="font-semibold">{totalFiat ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">Exchange rate</dt>
            <dd className="font-semibold">{exchangeRate ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">Network cost</dt>
            <dd className="font-semibold">Added by wallet</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">Amount paid</dt>
            <dd className="font-semibold">{formattedPaidAmount} XMR</dd>
          </div>
        </dl>

        <div className="grid gap-3 border-t border-stroke bg-sand/50 px-6 py-5">
          <a
            className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
            href={`/i/${encodeURIComponent(invoiceId)}/receipt`}
          >
            View receipt
          </a>
          {redirectUrl ? (
            <a
              className="inline-flex items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
              href={redirectUrl}
              target="_top"
              rel="noreferrer"
            >
              {formatReturnLabel(redirectUrl)}
            </a>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
      <header className="bg-ink px-6 py-6 text-center text-cream">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className="text-sm font-semibold text-cream/70">Payment request</p>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </div>
        <p className="mt-2 text-sm text-cream/70">
          {statusMessage(status, confirmationTarget)}
        </p>
        <div className="mt-3 flex items-start justify-center gap-3">
          <p className="break-words font-mono text-[clamp(1.8rem,1.55rem+1vw,2.3rem)] font-semibold leading-tight">
            {formattedAmount} XMR
          </p>
          {canSendPayment ? (
            <CopyIconButton
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cream/25 bg-cream/10 text-cream transition hover:bg-cream/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              value={formattedAmount}
              label="Copy exact amount"
            />
          ) : null}
        </div>
      </header>

      <div className="grid justify-items-center bg-sand/60 px-5 py-6">
        {canSendPayment && qrDataUrl ? (
          <div className="relative h-[240px] w-[240px] border border-stroke bg-white p-2 shadow-soft sm:h-[260px] sm:w-[260px]">
            <Image
              className="h-full w-full"
              src={qrDataUrl}
              alt="Payment request QR"
              width={260}
              height={260}
              unoptimized
            />
            {resolvedLogoSrc ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_6px_12px_rgba(16,18,23,0.12)]">
                  <Image
                    src={resolvedLogoSrc}
                    alt="QR logo"
                    width={38}
                    height={38}
                    unoptimized={resolvedQrLogoMode === "custom"}
                  />
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-stroke bg-cream/70 px-4 py-3 text-sm font-semibold text-ink-soft">
            {canSendPayment
              ? "QR is loading. Use the payment address below if it does not appear."
              : "Payment entry is unavailable for this invoice state."}
          </p>
        )}
      </div>

      <div className="border-t border-stroke px-6 py-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-soft">Address</p>
          {canSendPayment ? (
            <CopyIconButton value={address} label="Copy payment address" />
          ) : null}
        </div>
        <p className="mt-3 break-all bg-sand/60 px-3 py-3 font-mono text-xs leading-relaxed text-ink">
          {address}
        </p>
      </div>

      <details className="group border-t border-stroke px-6 py-5">
        <summary className="flex cursor-pointer items-center justify-center gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">View payment details</span>
          <span className="hidden group-open:inline">Hide payment details</span>
        </summary>
        <dl className="mt-4 divide-y divide-stroke text-sm text-ink">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-ink-soft">Total price</dt>
            <dd className="font-semibold">{formattedAmount} XMR</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-ink-soft">Total fiat</dt>
            <dd className="font-semibold">{totalFiat ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-ink-soft">Exchange rate</dt>
            <dd className="text-right font-semibold">{exchangeRate ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-ink-soft">Network cost</dt>
            <dd className="font-semibold">Added by wallet</dd>
          </div>
        </dl>
      </details>

      {canSendPayment ? (
        <div className="border-t border-stroke bg-sand/50 px-6 py-5">
          <a
            className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
            href={uri}
          >
            Pay in wallet
          </a>
        </div>
      ) : null}
    </section>
  );
}
