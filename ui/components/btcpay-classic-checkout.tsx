"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import InvoiceExpiry from "./invoice-expiry";
import { InvoiceRefreshFeedback } from "./invoice-status-auto-refresh";
import CopyIconButton from "./copy-icon-button";
import StatusBadge, { type StatusTone } from "./status-badge";
import { formatXmrAmount } from "../lib/formatting";
import { safeHttpUrl } from "../lib/linkify";
import {
  hasPartialAmount,
  invoiceStatusLabel,
  invoiceStatusTones,
  type InvoiceStatus,
} from "../lib/invoice-status";
import type { Translate } from "../lib/i18n/translate";
import { useI18n } from "./i18n-provider";


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
  amountRemainingXmr?: string | null;
  btcpayAmount: string | null;
  btcpayCurrency: string | null;
  quote: QuotePayload | null;
  status: InvoiceStatus;
  expiresAt?: string | null;
  expiryRetrievedAt?: string;
  confirmationTarget: number;
  confirmations: number;
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

const formatFiatAmount = (value: string, currency: string, locale: string) => {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) {
    return `${value} ${currency}`;
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const formatReturnLabel = (redirectUrl: string, t: Translate) => {
  try {
    const parsed = new URL(redirectUrl);
    return parsed.hostname
      ? t("classic.returnTo", { host: parsed.hostname })
      : t("checkout.returnToStore");
  } catch {
    return t("checkout.returnToStore");
  }
};

const statusMessage = (
  status: InvoiceStatus,
  confirmationTarget: number,
  hasPartial: boolean,
  t: Translate,
): string => {
  if (status === "invalid") {
    return t("pay.headingInvalid");
  }
  if (status === "expired" && hasPartial) {
    return t("pay.headingExpiredUnderpaid");
  }
  if (status === "partially_paid") {
    return t("pay.headingPartial");
  }
  if (status === "expired") {
    return t("pay.headingExpired");
  }
  if (status === "confirmed") {
    // A zero-confirmation target means the payment was seen, not yet mined.
    return confirmationTarget === 0 ? t("pay.headingSeen") : t("classic.confirmedAt", { count: confirmationTarget });
  }
  if (status === "payment_detected") {
    return t("classic.detectedAwaiting");
  }
  return t("classic.awaitingFunds");
};

export default function BtcpayClassicCheckout({
  invoiceId,
  address,
  amountXmr,
  amountPaidXmr,
  amountRemainingXmr = null,
  btcpayAmount,
  btcpayCurrency,
  quote,
  status,
  expiresAt,
  expiryRetrievedAt,
  confirmationTarget,
  confirmations,
  redirectUrl: storedRedirectUrl,
  redirectAutomatically,
  orderId,
  orderNumber,
  qrLogoMode,
  qrLogoDataUrl,
}: BtcpayClassicCheckoutProps) {
  const { locale, t } = useI18n();
  // The link comes from invoice metadata: only a plain web link may leave this page.
  const redirectUrl = safeHttpUrl(storedRedirectUrl);
  const [qrFailed, setQrFailed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const hasPartial = hasPartialAmount(amountPaidXmr, amountRemainingXmr);
  const isPartiallyPaid = status === "partially_paid" && hasPartial;
  const formattedAmount = useMemo(
    () => formatXmrAmount(amountXmr),
    [amountXmr],
  );
  const formattedPaidAmount = useMemo(
    () => (amountPaidXmr ? formatXmrAmount(amountPaidXmr) : null),
    [amountPaidXmr],
  );
  // A partially paid invoice requests only the remaining amount.
  const formattedRequestedAmount = useMemo(
    () =>
      isPartiallyPaid && amountRemainingXmr
        ? formatXmrAmount(amountRemainingXmr)
        : formattedAmount,
    [amountRemainingXmr, formattedAmount, isPartiallyPaid],
  );
  const uri = useMemo(
    () => buildMoneroUri(address, formattedRequestedAmount),
    [address, formattedRequestedAmount],
  );
  const totalFiat =
    btcpayAmount && btcpayCurrency && btcpayCurrency !== "XMR"
      ? formatFiatAmount(btcpayAmount, btcpayCurrency, locale)
      : null;
  const exchangeRate =
    quote?.rate && quote.fiat_currency
      ? `1 XMR = ${formatFiatAmount(quote.rate, quote.fiat_currency, locale)}`
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

  const canSendPayment = status === "pending" || status === "partially_paid";
  const resolvedQrLogoMode = qrLogoMode ?? "monero";
  const resolvedLogoSrc =
    resolvedQrLogoMode === "custom"
      ? qrLogoDataUrl
      : resolvedQrLogoMode === "monero"
        ? "/monero-logo.svg"
        : null;
  const statusTone: StatusTone = invoiceStatusTones[status];
  const statusLabel = invoiceStatusLabel(
    status,
    amountPaidXmr,
    amountRemainingXmr,
    t,
  );

  if (status === "confirmed") {
    return (
      <section className="min-w-0 overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
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
            {t("checkout.paymentRequest")}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{t("invoicePage.timelineConfirmed")}</h2>
          <StatusBadge className="mt-4" label={t("invoiceStatus.confirmed")} tone="success" />
        </header>
      <InvoiceRefreshFeedback className="border-b border-stroke px-6 py-3 text-xs text-ink-soft" />

        <dl className="divide-y divide-stroke px-6 py-3 text-sm text-ink">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">{t("checkout.invoiceId")}</dt>
            <dd className="max-w-[60%] truncate text-right font-semibold">
              {invoiceId}
            </dd>
          </div>
          {orderNumber || orderId ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-ink-soft">{t("classic.orderId")}</dt>
              <dd className="font-semibold">{orderNumber ?? orderId}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">{t("classic.totalPrice")}</dt>
            <dd className="font-semibold">{formattedAmount} XMR</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">{t("classic.totalFiat")}</dt>
            <dd className="font-semibold">{totalFiat ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">{t("classic.exchangeRate")}</dt>
            <dd className="font-semibold">{exchangeRate ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">{t("classic.networkCost")}</dt>
            <dd className="font-semibold">{t("classic.addedByWallet")}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-soft">{t("classic.amountPaid")}</dt>
            <dd className="font-semibold">
              {formattedPaidAmount ? `${formattedPaidAmount} XMR` : "-"}
            </dd>
          </div>
        </dl>

        <div className="grid gap-3 border-t border-stroke bg-sand/50 px-6 py-5">
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
            href={`/i/${encodeURIComponent(invoiceId)}/receipt`}
          >
            {t("checkout.viewReceipt")}
          </a>
          {redirectUrl ? (
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
              href={redirectUrl}
              target="_top"
              rel="noreferrer"
            >
              {formatReturnLabel(redirectUrl, t)}
            </a>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
      <header className="bg-ink px-6 py-6 text-center text-cream">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className="text-sm font-semibold text-cream/70">{t("checkout.paymentRequest")}</p>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </div>
        <p className="mt-2 text-sm text-cream/70">
          {status === "payment_detected" ? t("pay.headingDetected", { confirmations, target: confirmationTarget }) : statusMessage(status, confirmationTarget, hasPartial, t)}
        </p>
        {isPartiallyPaid ? (
          <p className="mt-3 text-xs font-semibold text-cream/70">
            {t("pay.remainingAmount")}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-start justify-center gap-3">
          <p className="min-w-0 break-words font-mono text-[clamp(1.8rem,1.55rem+1vw,2.3rem)] font-semibold leading-tight">
            {formattedRequestedAmount} XMR
          </p>
          {canSendPayment ? (
            <CopyIconButton
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cream/25 bg-cream/10 text-cream transition hover:bg-cream/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              value={formattedRequestedAmount}
              label={isPartiallyPaid ? t("pay.copyRemaining") : t("pay.copyExact")}
            />
          ) : null}
        </div>
        {hasPartial && formattedPaidAmount && status !== "invalid" ? (
          <p className="mt-2 text-sm font-semibold text-cream/80">
            {t("pay.received", { paid: formattedPaidAmount, total: formattedAmount })}
          </p>
        ) : null}
        {canSendPayment ? <InvoiceExpiry expiresAt={expiresAt ?? null} retrievedAt={expiryRetrievedAt} /> : null}
      </header>
      <InvoiceRefreshFeedback className="border-b border-stroke px-6 py-3 text-xs text-ink-soft" />

      {canSendPayment ? (
        <div className="border-t border-stroke bg-sand/50 px-6 py-5">
          <a
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
            href={uri}
          >
            {t("pay.openWallet")}
          </a>
        </div>
      ) : null}

      <div className="grid justify-items-center bg-sand/60 px-5 py-6">
        {canSendPayment && qrDataUrl ? (
          <div className="relative aspect-square w-[240px] max-w-full border border-stroke bg-white p-2 shadow-soft sm:w-[260px]">
            <Image
              className="h-full w-full"
              src={qrDataUrl}
              alt={t("pay.qrAlt")}
              width={260}
              height={260}
              unoptimized
            />
            {resolvedLogoSrc ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_6px_12px_rgba(16,18,23,0.12)]">
                  <Image
                    src={resolvedLogoSrc}
                    alt={t("pay.qrLogoAlt")}
                    width={38}
                    height={38}
                    unoptimized={resolvedQrLogoMode === "custom"}
                  />
                </span>
              </div>
            ) : null}
          </div>
        ) : status !== "expired" && status !== "invalid" ? (
          <p className="rounded-xl border border-stroke bg-cream/70 px-4 py-3 text-sm font-semibold text-ink-soft">
            {canSendPayment
              ? qrFailed
                ? t("pay.qrFailed")
                : t("pay.qrLoading")
              : status === "payment_detected"
                ? t("pay.waitingConfirmations", { confirmations, target: confirmationTarget })
                : statusMessage(status, confirmationTarget, hasPartial, t)}
          </p>
        ) : null}
      </div>

      <div className="border-t border-stroke px-6 py-5">
        {canSendPayment ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink-soft">{t("classic.address")}</p>
              <CopyIconButton value={address} label={t("pay.copyAddress")} />
            </div>
            <p className="mt-3 break-all bg-sand/60 px-3 py-3 font-mono text-xs leading-relaxed text-ink">
              {address}
            </p>
          </>
        ) : status === "expired" ? (
          <p className="border-l-2 border-red-400 pl-3 text-sm leading-relaxed text-red-700">
            {hasPartial && formattedPaidAmount
              ? t("pay.contactAboutReceived", { paid: formattedPaidAmount })
              : t("pay.requestNew")}
          </p>
        ) : (
          <p className="border-l-2 border-stroke pl-3 text-sm leading-relaxed text-ink-soft">
            {status === "payment_detected" ? t("classic.noFurtherPayment") : t("pay.headingInvalid")}
          </p>
        )}
        {(status === "expired" || status === "invalid") && redirectUrl ? (
          <a
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 w-full"
            href={redirectUrl}
            target="_top"
            rel="noreferrer"
          >
            {formatReturnLabel(redirectUrl, t)}
          </a>
        ) : null}
      </div>

      <details className="group border-t border-stroke px-6 py-5">
        <summary className="flex cursor-pointer items-center justify-center gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">{t("classic.viewDetails")}</span>
          <span className="hidden group-open:inline">{t("classic.hideDetails")}</span>
        </summary>
        <dl className="mt-4 divide-y divide-stroke text-sm text-ink">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-ink-soft">{t("classic.totalPrice")}</dt>
            <dd className="font-semibold">{formattedAmount} XMR</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-ink-soft">{t("classic.totalFiat")}</dt>
            <dd className="font-semibold">{totalFiat ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-ink-soft">{t("classic.exchangeRate")}</dt>
            <dd className="text-right font-semibold">{exchangeRate ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-ink-soft">{t("classic.networkCost")}</dt>
            <dd className="font-semibold">{t("classic.addedByWallet")}</dd>
          </div>
          {hasPartial && formattedPaidAmount ? (
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">{t("classic.amountReceived")}</dt>
              <dd className="font-semibold">{formattedPaidAmount} XMR</dd>
            </div>
          ) : null}
        </dl>
      </details>


    </section>
  );
}
