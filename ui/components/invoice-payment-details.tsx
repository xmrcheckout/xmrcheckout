"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import InvoiceExpiry from "./invoice-expiry";
import { InvoiceRefreshFeedback } from "./invoice-status-auto-refresh";
import Timestamp from "./timestamp";
import CopyIconButton from "./copy-icon-button";
import StatusBadge, { type StatusTone } from "./status-badge";
import {
  formatFiatAmount,
  formatUsdAmount,
  formatXmrAmount,
} from "../lib/formatting";
import { useXmrUsdRate } from "../lib/use-xmr-usd-rate";
import { fill } from "../lib/i18n/rich";
import { useI18n } from "./i18n-provider";
import {
  hasPartialAmount,
  invoiceStatusLabel,
  invoiceStatusTones,
  type InvoiceStatus,
} from "../lib/invoice-status";

export type InvoiceFiatQuote = {
  fiat_amount: string;
  fiat_currency: string;
  rate: string;
  source: string;
  quoted_at: string;
};

type InvoicePaymentDetailsProps = {
  address: string;
  amount: string;
  amountPaid?: string | null;
  amountRemaining?: string | null;
  hasDetectedPayment: boolean;
  expiresAt?: string | null;
  expiryRetrievedAt?: string;
  status: InvoiceStatus;
  confirmationTarget: number;
  confirmations: number;
  qrLogoMode?: "monero" | "none" | "custom" | null;
  qrLogoDataUrl?: string | null;
  enableFiatEstimate?: boolean;
  quote?: InvoiceFiatQuote | null;
};

const buildMoneroUri = (address: string, amount: string) => {
  const params = new URLSearchParams();
  params.set("tx_amount", amount);
  return `monero:${address}?${params.toString()}`;
};

export default function InvoicePaymentDetails({
  address,
  amount,
  amountPaid = null,
  amountRemaining = null,
  hasDetectedPayment,
  expiresAt,
  expiryRetrievedAt,
  status,
  confirmationTarget,
  confirmations,
  qrLogoMode,
  qrLogoDataUrl,
  enableFiatEstimate = true,
  quote = null,
}: InvoicePaymentDetailsProps) {
  const { locale, t } = useI18n();
  const [qrFailed, setQrFailed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const {
    rate: usdRate,
    updatedAt: usdRateUpdatedAt,
    source: usdRateSource,
  } = useXmrUsdRate(enableFiatEstimate && !quote);
  const isInvalid = status === "invalid";
  const isExpired = status === "expired";
  const hasPartial = hasPartialAmount(amountPaid, amountRemaining);
  const isPartiallyPaid = status === "partially_paid" && hasPartial;
  const isExpiredUnderpaid = isExpired && hasPartial;
  const canSendPayment = status === "pending" || status === "partially_paid";
  const shouldPromptPayment =
    canSendPayment && !hasDetectedPayment && !isInvalid;
  // A partially paid invoice requests only the remaining amount.
  const requestedAmount =
    isPartiallyPaid && amountRemaining ? amountRemaining : amount;
  const formattedAmount = useMemo(
    () => formatXmrAmount(requestedAmount),
    [requestedAmount],
  );
  const formattedTotal = useMemo(() => formatXmrAmount(amount), [amount]);
  const formattedPaid = useMemo(
    () => (amountPaid ? formatXmrAmount(amountPaid) : null),
    [amountPaid],
  );
  const uri = useMemo(
    () => buildMoneroUri(address, formattedAmount),
    [address, formattedAmount],
  );
  const amountValue = useMemo(() => {
    const parsed = Number.parseFloat(requestedAmount);
    return Number.isFinite(parsed) ? parsed : null;
  }, [requestedAmount]);
  const merchantPrice = useMemo(
    () =>
      quote ? formatFiatAmount(quote.fiat_amount, quote.fiat_currency, locale) : null,
    [quote, locale],
  );
  const usdEstimate = useMemo(() => {
    if (quote || !usdRate || amountValue === null || amountValue <= 0) {
      return null;
    }
    return formatUsdAmount(usdRate * amountValue, locale);
  }, [quote, usdRate, amountValue, locale]);

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
      ? t("pay.sourceCoingecko")
      : t("pay.sourceExternal");
  const statusLabel = invoiceStatusLabel(status, amountPaid, amountRemaining, t);
  const heading = isInvalid
    ? t("pay.headingInvalid")
    : isExpiredUnderpaid
      ? t("pay.headingExpiredUnderpaid")
      : isExpired
      ? t("pay.headingExpired")
      : isPartiallyPaid
      ? t("pay.headingPartial")
      : hasDetectedPayment
        ? status === "confirmed"
          ? confirmationTarget === 0 && confirmations === 0
            ? t("pay.headingSeen")
            : t("pay.headingConfirmed", { count: confirmationTarget === 0 ? confirmations : confirmationTarget })
          : t("pay.headingDetected", { confirmations, target: confirmationTarget })
        : t("pay.headingSend");
  const showCopyActions = canSendPayment;
  const showPaymentUri = canSendPayment;
  const statusTone: StatusTone = invoiceStatusTones[status];

  return (
    <section className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
      <header className="bg-ink px-5 py-5 text-cream sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-cream/70">
              {t("pay.details")}
            </p>
            <h2 className="mt-2 font-sans text-2xl font-semibold leading-tight">
              {heading}
            </h2>
          </div>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </div>
        {(isPartiallyPaid || isExpiredUnderpaid) && formattedPaid ? (
          <p className="mt-4 text-sm font-semibold text-cream/80">
            {t("pay.received", { paid: formattedPaid, total: formattedTotal })}
          </p>
        ) : null}
        {isInvalid || isExpired ? (
          <p className="mt-4 border-l-2 border-red-300 pl-3 text-sm font-semibold text-red-100">
            {t("pay.requestNew")}
          </p>
        ) : null}
      </header>

      <InvoiceRefreshFeedback className="border-b border-stroke px-5 py-3 text-xs text-ink-soft sm:px-7" />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 px-5 py-6 sm:px-7 lg:border-r lg:border-stroke">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-soft">
                {isPartiallyPaid ? t("pay.remainingAmount") : canSendPayment ? t("pay.exactAmount") : t("pay.invoiceAmount")}
              </p>
              <p className="mt-2 break-words font-mono text-[clamp(1.8rem,1.55rem+1vw,2.5rem)] font-semibold leading-tight text-ink">
                {formattedAmount} XMR
              </p>
            </div>
            {showCopyActions ? (
              <CopyIconButton
                value={formattedAmount}
                label={isPartiallyPaid ? t("pay.copyRemaining") : t("pay.copyExact")}
              />
            ) : null}
          </div>

          {canSendPayment ? <InvoiceExpiry expiresAt={expiresAt ?? null} retrievedAt={expiryRetrievedAt} /> : null}

          {canSendPayment ? (
              <a
                className="mt-4 min-h-11 inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                href={uri}
              >
                {t("pay.openWallet")}
              </a>
          ) : null}

          {shouldPromptPayment ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {isPartiallyPaid
              ? `${t("pay.sendRemainingOnly", { paid: formattedPaid ?? "" })} `
              : ""}
            {t("pay.feeNote")}
          </p>
          ) : null}

          {quote && merchantPrice ? (
            <div className="mt-3 text-sm text-ink-soft">
              <p>{t("pay.merchantPrice", { price: merchantPrice })}</p>
              <details className="mt-1 w-fit text-xs">
                <summary className="cursor-pointer select-none underline underline-offset-4">
                  {t("pay.aboutPrice")}
                </summary>
                <p className="mt-2 max-w-[52ch] leading-relaxed">
                  {fill(
                    t("pay.priceDetail", {
                      rate: quote.rate,
                      currency: quote.fiat_currency.toUpperCase(),
                      source: quote.source,
                    }),
                    { time: <Timestamp value={quote.quoted_at} /> },
                  )}
                </p>
              </details>
            </div>
          ) : canSendPayment && usdEstimate ? (
            <div className="mt-3 text-sm text-ink-soft">
              <p>{t("pay.usdReference", { amount: usdEstimate })}</p>
              <details className="mt-1 w-fit text-xs">
                <summary className="cursor-pointer select-none underline underline-offset-4">
                  {t("pay.aboutEstimate")}
                </summary>
                <p className="mt-2 max-w-[52ch] leading-relaxed">
                  {usdRateUpdatedAt
                    ? fill(t("pay.estimateDetailTimed", { source: estimateSourceLabel }), {
                        time: <Timestamp value={new Date(usdRateUpdatedAt).toISOString()} />,
                      })
                    : t("pay.estimateDetail", { source: estimateSourceLabel })}
                </p>
              </details>
            </div>
          ) : null}

          {!isInvalid && !isExpired ? (
            <div className="mt-6 border-t border-stroke pt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-ink-soft">
                  {t("pay.address")}
                </p>
                {showCopyActions ? (
                  <CopyIconButton value={address} label={t("pay.copyAddress")} />
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
                {t("pay.advancedUri")}
              </summary>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-ink-soft">URI</p>
                  <CopyIconButton value={uri} label={t("pay.copyUri")} />
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
            {canSendPayment ? t("pay.scan") : status === "payment_detected" ? t("pay.progress") : status === "confirmed" ? t("pay.complete") : t("pay.unavailable")}
          </p>
          {canSendPayment && qrDataUrl ? (
            <>
              <div className="relative mt-4 aspect-square w-[220px] max-w-full border border-stroke bg-white p-2 shadow-soft sm:w-[240px]">
                <Image
                  className="h-full w-full bg-white"
                  src={qrDataUrl}
                  alt={t("pay.qrAlt")}
                  width={240}
                  height={240}
                  unoptimized
                />
                {resolvedLogoSrc ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_4px_10px_rgba(16,18,23,0.12)]">
                      <Image
                        src={resolvedLogoSrc}
                        alt={t("pay.qrLogoAlt")}
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
                ? t("pay.noLongerValid")
                : isInvalid
                  ? t("pay.entryUnavailable")
                : status === "payment_detected"
                  ? t("pay.waitingConfirmations", { confirmations, target: confirmationTarget })
                  : status === "confirmed"
                    ? t("pay.targetReached")
                    : qrFailed
                      ? t("pay.qrFailed")
                      : t("pay.qrLoading")}
            </p>
          ) : null}

        </div>
      </div>
    </section>
  );
}
