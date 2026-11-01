"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import InvoiceExpiry from "./invoice-expiry";
import { InvoiceRefreshFeedback } from "./invoice-status-auto-refresh";
import Timestamp from "./timestamp";
import CopyIconButton from "./copy-icon-button";
import StatusBadge, { type StatusTone } from "./status-badge";
import { formatUsdAmount, formatXmrAmount } from "../lib/formatting";
import { useXmrUsdRate } from "../lib/use-xmr-usd-rate";

type InvoicePaymentDetailsProps = {
  address: string;
  amount: string;
  hasDetectedPayment: boolean;
  expiresAt?: string | null;
  expiryRetrievedAt?: string;
  status: "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
  confirmationTarget: number;
  confirmations: number;
  qrLogoMode?: "monero" | "none" | "custom" | null;
  qrLogoDataUrl?: string | null;
  enableFiatEstimate?: boolean;
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
  expiresAt,
  expiryRetrievedAt,
  status,
  confirmationTarget,
  confirmations,
  qrLogoMode,
  qrLogoDataUrl,
  enableFiatEstimate = true,
}: InvoicePaymentDetailsProps) {
  const [qrFailed, setQrFailed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const {
    rate: usdRate,
    updatedAt: usdRateUpdatedAt,
    source: usdRateSource,
  } = useXmrUsdRate(enableFiatEstimate);
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
          setQrFailed(!url);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl(null);
          setQrFailed(true);
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
      ? "Invoice expired. Do not send payment."
      : hasDetectedPayment
        ? status === "confirmed"
          ? `Payment confirmed on-chain at ${confirmationLabel}.`
          : `Payment detected. ${confirmations}/${confirmationTarget} confirmations.`
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
            Contact the merchant to request a new invoice.
          </p>
        ) : null}
      </header>

      <InvoiceRefreshFeedback className="border-b border-stroke px-5 py-3 text-xs text-ink-soft sm:px-7" />

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

          {canSendPayment ? <InvoiceExpiry expiresAt={expiresAt ?? null} retrievedAt={expiryRetrievedAt} /> : null}

          {canSendPayment ? (
              <a
                className="mt-4 min-h-11 inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                href={uri}
              >
                Open wallet
              </a>
          ) : null}

          {shouldPromptPayment ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Your wallet adds the network fee on top. Do not subtract it from the
            amount shown.
          </p>
          ) : null}

          {usdEstimate ? (
            <div className="mt-3 text-sm text-ink-soft">
              <p>Approx. USD reference: ~{usdEstimate}</p>
              <details className="mt-1 w-fit text-xs">
                <summary className="cursor-pointer select-none underline underline-offset-4">
                  About this estimate
                </summary>
                <p className="mt-2 max-w-[52ch] leading-relaxed">
                  Reference only, uses {estimateSourceLabel}
                  {usdRateUpdatedAt ? <> from <Timestamp value={new Date(usdRateUpdatedAt).toISOString()} /></> : null}. Not a
                  quote or guarantee.
                </p>
              </details>
            </div>
          ) : null}

          {!isInvalid && !isExpired ? (
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
          ) : null}

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

              </div>
            </details>
          ) : null}
        </div>

        <div className="grid content-center justify-items-center bg-sand/60 px-5 py-6 sm:px-7">
          <p className="justify-self-start text-xs font-semibold text-ink-soft lg:justify-self-center">
            {canSendPayment ? "Scan with a Monero wallet" : status === "payment_detected" ? "Confirmation progress" : status === "confirmed" ? "Payment complete" : "Payment unavailable"}
          </p>
          {canSendPayment && qrDataUrl ? (
            <>
              <div className="relative mt-4 aspect-square w-[220px] max-w-full border border-stroke bg-white p-2 shadow-soft sm:w-[240px]">
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

            </>
          ) : !isExpired && !isInvalid ? (
            <p className="mt-4 border-l-2 border-stroke pl-3 text-sm leading-relaxed text-ink-soft">
              {isExpired
                ? "This invoice is no longer valid. Contact the merchant to request a new invoice."
                : isInvalid
                  ? "Payment entry is unavailable for this invoice state."
                : status === "payment_detected"
                  ? `${confirmations}/${confirmationTarget} confirmations. No further payment is requested. Waiting for confirmations.`
                  : status === "confirmed"
                    ? "The confirmation target has been reached. No further payment is requested."
                    : qrFailed
                      ? "QR code could not be generated. Copy the payment address and exact amount into your wallet."
                      : "QR code is loading. You can also copy the payment address and exact amount into your wallet."}
            </p>
          ) : null}

        </div>
      </div>
    </section>
  );
}
