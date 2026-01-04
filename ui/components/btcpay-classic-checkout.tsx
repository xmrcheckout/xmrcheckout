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
  address: string;
  amountXmr: string;
  btcpayAmount: string | null;
  btcpayCurrency: string | null;
  quote: QuotePayload | null;
  status: InvoiceStatus;
  confirmationTarget: number;
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
  address,
  amountXmr,
  btcpayAmount,
  btcpayCurrency,
  quote,
  status,
  confirmationTarget,
  qrLogoMode,
  qrLogoDataUrl,
}: BtcpayClassicCheckoutProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const formattedAmount = useMemo(() => formatXmrAmount(amountXmr), [amountXmr]);
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

  return (
    <div className="rounded-[28px] border border-stroke bg-white px-6 py-8 shadow-card">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Payment request
        </p>
        <p className="mt-3 text-[1.9rem] font-semibold text-ink">
          {formattedAmount} XMR
        </p>
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
            <dd className="font-semibold">{formattedAmount} XMR</dd>
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
