"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import CopyIconButton from "./copy-icon-button";
import StatusBadge, { type StatusTone } from "./status-badge";
import { formatUsdAmount, formatXmrAmount } from "../lib/formatting";
import { useXmrUsdRate } from "../lib/use-xmr-usd-rate";

type InvoicePaymentDetailsProps = {
  address: string;
  amount: string;
  hasDetectedPayment: boolean;
  status: "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
  confirmationTarget: number;
  qrLogoMode?: "monero" | "none" | "custom" | null;
  qrLogoDataUrl?: string | null;
};

const buildMoneroUri = (address: string, amount: string) => {
  const params = new URLSearchParams();
  params.set("tx_amount", amount);
  return `monero:${address}?${params.toString()}`;
};

export default function InvoicePaymentDetails({
  address,
  amount,
  hasDetectedPayment,
  status,
  confirmationTarget,
  qrLogoMode,
  qrLogoDataUrl,
}: InvoicePaymentDetailsProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const {
    rate: usdRate,
    updatedAt: usdRateUpdatedAt,
    source: usdRateSource,
  } = useXmrUsdRate();
  const isInvalid = status === "invalid";
  const isExpired = status === "expired";
  const canSendPayment = status === "pending";
  const shouldPromptPayment =
    canSendPayment && !hasDetectedPayment && !isInvalid;
  const formattedAmount = useMemo(() => formatXmrAmount(amount), [amount]);
  const uri = useMemo(
    () => buildMoneroUri(address, formattedAmount),
    [address, formattedAmount],
  );
  const amountValue = useMemo(() => {
    const parsed = Number.parseFloat(amount);
    return Number.isFinite(parsed) ? parsed : null;
  }, [amount]);
  const usdEstimate = useMemo(() => {
    if (!usdRate || amountValue === null || amountValue <= 0) {
      return null;
    }
    return formatUsdAmount(usdRate * amountValue);
  }, [usdRate, amountValue]);

  useEffect(() => {
    let active = true;
    const size = 200;
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

  const resolvedQrLogoMode = qrLogoMode ?? "monero";
  const resolvedLogoSrc =
    resolvedQrLogoMode === "custom"
      ? qrLogoDataUrl
      : resolvedQrLogoMode === "monero"
        ? "/monero-logo.svg"
        : null;
  const estimateSourceLabel =
    usdRateSource === "coingecko"
      ? "CoinGecko spot rate"
      : "external spot rate";
  const estimateTimestamp = usdRateUpdatedAt
    ? new Date(usdRateUpdatedAt).toLocaleString()
    : null;
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
  const confirmationLabel = `${confirmationTarget} confirmation${
    confirmationTarget === 1 ? "" : "s"
  }`;
  const heading = isInvalid
    ? "Invoice marked invalid. Do not send payment."
    : isExpired
      ? "Invoice expired before detection."
      : hasDetectedPayment
        ? status === "confirmed"
          ? `Payment confirmed on-chain at ${confirmationLabel}.`
          : "Payment detected. Confirmations are in progress."
        : "Send the exact amount to this address.";
  const showCopyActions = canSendPayment;
  const showPaymentUri = canSendPayment;
  const statusTone: StatusTone =
    status === "pending"
      ? "pending"
      : status === "payment_detected"
        ? "detected"
        : status === "confirmed"
          ? "success"
          : "error";

  return (
    <section className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
      <header className="bg-ink px-5 py-5 text-cream sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-cream/70">
              Payment details
            </p>
            <h2 className="mt-2 font-sans text-2xl font-semibold leading-tight">
              {heading}
            </h2>
          </div>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </div>
        {isInvalid || isExpired ? (
          <p className="mt-4 border-l-2 border-red-300 pl-3 text-sm font-semibold text-red-100">
            Do not send payment for this invoice state.
          </p>
        ) : shouldPromptPayment ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cream/70">
            Your wallet adds the network fee on top. Do not subtract it from the
            amount shown.
          </p>
        ) : null}
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 px-5 py-6 sm:px-7 lg:border-r lg:border-stroke">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-soft">
                Exact amount
              </p>
              <p className="mt-2 break-words font-mono text-[clamp(1.8rem,1.55rem+1vw,2.5rem)] font-semibold leading-tight text-ink">
                {formattedAmount} XMR
              </p>
            </div>
            {showCopyActions ? (
              <CopyIconButton
                value={formattedAmount}
                label="Copy exact amount"
              />
            ) : null}
          </div>

          {usdEstimate ? (
            <div className="mt-3 text-sm text-ink-soft">
              <p>Approx. USD reference: ~{usdEstimate}</p>
              <details className="mt-1 w-fit text-xs">
                <summary className="cursor-pointer select-none underline underline-offset-4">
                  About this estimate
                </summary>
                <p className="mt-2 max-w-[52ch] leading-relaxed">
                  Reference only, uses {estimateSourceLabel}
                  {estimateTimestamp ? ` from ${estimateTimestamp}` : ""}. Not a
                  quote or guarantee.
                </p>
              </details>
            </div>
          ) : null}

          <div className="mt-6 border-t border-stroke pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-ink-soft">
                Payment address
              </p>
              {showCopyActions ? (
                <CopyIconButton value={address} label="Copy payment address" />
              ) : null}
            </div>
            <p className="mt-3 break-all bg-sand/60 px-3 py-3 font-mono text-xs leading-relaxed text-ink sm:text-sm">
              {address}
            </p>
          </div>

          {showPaymentUri ? (
            <details className="mt-5 border-t border-stroke pt-5">
              <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
                Advanced wallet URI
              </summary>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-ink-soft">URI</p>
                  <CopyIconButton value={uri} label="Copy wallet URI" />
                </div>
                <p className="break-all bg-sand/60 px-3 py-3 font-mono text-xs leading-relaxed text-ink">
                  {uri}
                </p>
                {shouldPromptPayment ? (
                  <p className="text-sm leading-relaxed text-ink-soft">
                    This page updates automatically after the payment is
                    detected on-chain.
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>

        <div className="grid content-center justify-items-center bg-sand/60 px-5 py-6 sm:px-7">
          <p className="justify-self-start text-xs font-semibold text-ink-soft lg:justify-self-center">
            Scan with a Monero wallet
          </p>
          {canSendPayment && qrDataUrl ? (
            <>
              <div className="relative mt-4 h-[220px] w-[220px] border border-stroke bg-white p-2 shadow-soft sm:h-[240px] sm:w-[240px]">
                <Image
                  className="h-full w-full bg-white"
                  src={qrDataUrl}
                  alt="Payment request QR"
                  width={240}
                  height={240}
                  unoptimized
                />
                {resolvedLogoSrc ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_4px_10px_rgba(16,18,23,0.12)]">
                      <Image
                        src={resolvedLogoSrc}
                        alt="QR logo"
                        width={32}
                        height={32}
                        unoptimized={resolvedQrLogoMode === "custom"}
                      />
                    </span>
                  </div>
                ) : null}
              </div>
              <a
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                href={uri}
              >
                Open wallet
              </a>
            </>
          ) : (
            <p className="mt-4 border-l-2 border-stroke pl-3 text-sm leading-relaxed text-ink-soft">
              {isInvalid || isExpired
                ? "Payment entry is unavailable for this invoice state."
                : "The QR code is available while the invoice is awaiting funds."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
