"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { formatXmrAmount } from "../lib/formatting";

type InvoiceStatus =
  | "pending"
  | "payment_detected"
  | "confirmed"
  | "expired"
  | "invalid";

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
  confirmationTarget: number
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const formattedAmount = useMemo(() => formatXmrAmount(amountXmr), [amountXmr]);
  const formattedPaidAmount = useMemo(() => {
    if (!amountPaidXmr) {
      return formattedAmount;
    }
    return formatXmrAmount(amountPaidXmr);
  }, [amountPaidXmr, formattedAmount]);
  const uri = useMemo(
    () => buildMoneroUri(address, formattedAmount),
    [address, formattedAmount]
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

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current));
      }, 1500);
    } catch {
      setCopiedField(null);
    }
  };

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

  const isActionDisabled = status === "expired" || status === "invalid";
  const resolvedQrLogoMode = qrLogoMode ?? "monero";
  const resolvedLogoSrc =
    resolvedQrLogoMode === "custom"
      ? qrLogoDataUrl
      : resolvedQrLogoMode === "monero"
        ? "/monero-logo.svg"
        : null;

  if (status === "confirmed") {
    return (
      <div className="rounded-[28px] border border-stroke bg-white px-6 py-8 shadow-card">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage/15 text-sage">
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
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-ink-soft">
            Invoice paid
          </p>
        </div>

        <dl className="mt-6 grid gap-3 text-sm text-ink">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Invoice id</dt>
            <dd className="max-w-[60%] truncate text-right font-semibold">{invoiceId}</dd>
          </div>
          {orderNumber || orderId ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-soft">Order id</dt>
              <dd className="font-semibold">{orderNumber ?? orderId}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Total price</dt>
            <dd className="font-semibold">{formattedAmount} XMR</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Total fiat</dt>
            <dd className="font-semibold">{totalFiat ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Exchange rate</dt>
            <dd className="font-semibold">{exchangeRate ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Network cost</dt>
            <dd className="font-semibold">Added by wallet</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Amount paid</dt>
            <dd className="font-semibold">{formattedPaidAmount} XMR</dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-3">
          <a
            className="inline-flex items-center justify-center rounded-full bg-sage px-6 py-3 text-sm font-semibold text-cream shadow-[0_14px_22px_rgba(93,122,106,0.25)] transition hover:-translate-y-0.5"
            href={`/i/${encodeURIComponent(invoiceId)}/receipt`}
          >
            View receipt
          </a>
          {redirectUrl ? (
            <a
              className="inline-flex items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-sage transition hover:bg-cream"
              href={redirectUrl}
              target="_top"
              rel="noreferrer"
            >
              {formatReturnLabel(redirectUrl)}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-stroke bg-white px-6 py-8 shadow-card">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Payment request
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <p className="text-[1.9rem] font-semibold text-ink">{formattedAmount} XMR</p>
          <button
            className="rounded-full border border-stroke bg-white/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:bg-white"
            type="button"
            onClick={() => handleCopy(formattedAmount, "amount")}
          >
            {copiedField === "amount" ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-sm text-sage">{statusMessage(status, confirmationTarget)}</p>
      </div>

      <details className="group mt-5 rounded-2xl border border-stroke bg-cream/70 px-5 py-4">
        <summary className="flex cursor-pointer items-center justify-center gap-2 text-sm font-semibold text-sage [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">View details</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>
        <dl className="mt-4 grid gap-3 text-sm text-ink">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Total price</dt>
            <dd className="font-semibold">{formattedAmount} XMR</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Total fiat</dt>
            <dd className="font-semibold">{totalFiat ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Exchange rate</dt>
            <dd className="font-semibold">{exchangeRate ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Network cost</dt>
            <dd className="font-semibold">Added by wallet</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-soft">Amount due</dt>
            <dd className="flex items-center gap-2 font-semibold">
              <span>{formattedAmount} XMR</span>
              <button
                className="rounded-full border border-stroke bg-white/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:bg-white"
                type="button"
                onClick={() => handleCopy(formattedAmount, "amount")}
              >
                {copiedField === "amount" ? "Copied" : "Copy"}
              </button>
            </dd>
          </div>
        </dl>
      </details>

      <div className="mt-6 flex items-center justify-center">
        {qrDataUrl ? (
          <div className="relative rounded-2xl border border-ink/10 bg-white p-3 shadow-soft">
            <Image
              className="h-[260px] w-[260px]"
              src={qrDataUrl}
              alt="Payment request QR"
              width={260}
              height={260}
              unoptimized
            />
            {resolvedLogoSrc ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_8px_16px_rgba(16,18,23,0.18)]">
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
        ) : null}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            Address
          </p>
          <button
            className="rounded-full border border-stroke bg-white/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:bg-white"
            type="button"
            onClick={() => handleCopy(address, "address")}
          >
            {copiedField === "address" ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-3 break-all rounded-xl bg-ink/5 px-3 py-2 font-mono text-xs text-ink">
          {address}
        </p>
      </div>

      <a
        className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-cream transition ${
          isActionDisabled
            ? "cursor-not-allowed bg-ink/30"
            : "bg-sage shadow-[0_14px_22px_rgba(93,122,106,0.25)] hover:-translate-y-0.5"
        }`}
        href={isActionDisabled ? undefined : uri}
        aria-disabled={isActionDisabled}
      >
        Pay in wallet
      </a>
    </div>
  );
}
