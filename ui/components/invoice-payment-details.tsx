"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { rate: usdRate, updatedAt: usdRateUpdatedAt, source: usdRateSource } =
    useXmrUsdRate();
  const isInvalid = status === "invalid";
  const isExpired = status === "expired";
  const canSendPayment = status === "pending";
  const shouldPromptPayment = canSendPayment && !hasDetectedPayment && !isInvalid;
  const formattedAmount = useMemo(() => formatXmrAmount(amount), [amount]);
  const uri = useMemo(
    () => buildMoneroUri(address, formattedAmount),
    [address, formattedAmount]
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
    usdRateSource === "coingecko" ? "CoinGecko spot rate" : "external spot rate";
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

  return (
    <section className="rounded-2xl border border-stroke bg-card p-6 shadow-card backdrop-blur sm:p-8">
      <span className="sr-only" role="status" aria-live="polite">
        {copiedField ? `${copiedField} copied to clipboard` : ""}
      </span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">
            Payment details
          </p>
          <h2 className="mt-2 font-serif text-2xl">{heading}</h2>
          {isInvalid || isExpired ? (
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              Do not send payment for this invoice state.
            </p>
          ) : shouldPromptPayment ? (
            <p className="mt-2 text-sm text-ink-soft">
              Your wallet adds the network fee on top. Do not subtract it from
              the amount shown.
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          {statusLabel}
        </span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-5">
          <div className="rounded-2xl border border-stroke bg-white/75 p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Exact amount
              </p>
              {showCopyActions ? (
                <button
                  className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:bg-white"
                  type="button"
                  onClick={() => handleCopy(formattedAmount, "amount")}
                >
                  {copiedField === "amount" ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>
            <p className="mt-3 break-words font-mono text-3xl font-semibold text-ink">
              {formattedAmount} XMR
            </p>
            {usdEstimate ? (
              <>
                <p className="mt-2 text-sm text-ink-soft">
                  Approx. USD reference: ~{usdEstimate}
                </p>
                <details className="mt-1 w-fit text-xs text-ink-soft">
                  <summary className="cursor-pointer select-none underline underline-offset-4">
                    About this estimate
                  </summary>
                  <p className="mt-2 max-w-[46ch] leading-relaxed">
                    Reference only, uses {estimateSourceLabel}
                    {estimateTimestamp ? ` from ${estimateTimestamp}` : ""}. Not a quote or
                    guarantee.
                  </p>
                </details>
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border border-stroke bg-white/65 p-5 shadow-soft xl:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Scan or open wallet
            </p>
            {canSendPayment && qrDataUrl ? (
              <div className="mt-4 grid justify-items-center gap-4">
                <div className="relative h-[220px] w-[220px] rounded-2xl border border-stroke bg-white p-2 shadow-soft">
                  <Image
                    className="h-full w-full rounded-xl border border-ink/10 bg-white"
                    src={qrDataUrl}
                    alt="Payment request QR"
                    width={220}
                    height={220}
                    unoptimized
                  />
                  {resolvedLogoSrc ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_6px_12px_rgba(16,18,23,0.18)]">
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
                  className="inline-flex w-full items-center justify-center rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-cream shadow-[0_14px_24px_rgba(16,18,23,0.16)] transition hover:-translate-y-0.5"
                  href={uri}
                >
                  Open wallet
                </a>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">
                {isInvalid || isExpired
                  ? "Payment entry is unavailable for this invoice state."
                  : "QR is available while the invoice is awaiting funds."}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-stroke bg-white/65 p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Payment address
              </p>
              {showCopyActions ? (
                <button
                  className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:bg-white"
                  type="button"
                  onClick={() => handleCopy(address, "address")}
                >
                  {copiedField === "address" ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>
            <p className="mt-3 break-words rounded-xl bg-ink/10 px-3 py-2 font-mono text-xs text-ink sm:text-sm">
              {address}
            </p>
          </div>
        </div>

        <div className="hidden rounded-2xl border border-stroke bg-white/65 p-5 shadow-soft xl:block">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            Scan or open wallet
          </p>
          {canSendPayment && qrDataUrl ? (
            <div className="mt-4 grid justify-items-center gap-4">
              <div className="relative h-[200px] w-[200px] rounded-2xl border border-stroke bg-white p-2 shadow-soft">
                <Image
                  className="h-full w-full rounded-xl border border-ink/10 bg-white"
                  src={qrDataUrl}
                  alt="Payment request QR"
                  width={200}
                  height={200}
                  unoptimized
                />
                {resolvedLogoSrc ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_6px_12px_rgba(16,18,23,0.18)]">
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
                className="inline-flex w-full items-center justify-center rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-cream shadow-[0_14px_24px_rgba(16,18,23,0.16)] transition hover:-translate-y-0.5"
                href={uri}
              >
                Open wallet
              </a>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">
              {isInvalid || isExpired
                ? "Payment entry is unavailable for this invoice state."
                : "QR is available while the invoice is awaiting funds."}
            </p>
          )}
        </div>
      </div>

      {showPaymentUri ? (
        <details className="mt-6 rounded-2xl border border-stroke bg-white/60 p-5 shadow-soft">
          <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
            Advanced wallet URI
          </summary>
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                URI
              </p>
              <button
                className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:bg-white"
                type="button"
                onClick={() => handleCopy(uri, "uri")}
              >
                {copiedField === "uri" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="break-words rounded-xl bg-ink/10 px-3 py-2 font-mono text-xs text-ink sm:text-sm">
              {uri}
            </p>
            {shouldPromptPayment ? (
              <p className="text-sm text-ink-soft">
                After you pay, this page updates automatically once the payment is
                detected on-chain.
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}
