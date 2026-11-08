import type { Metadata } from "next";
import MissingBuyerLink from "../../../components/missing-buyer-link";

import BtcpayModalBridge from "../../../components/btcpay-modal-bridge";
import BtcpayClassicCheckout from "../../../components/btcpay-classic-checkout";
import CopyIconButton from "../../../components/copy-icon-button";
import InvoicePaymentDetails from "../../../components/invoice-payment-details";
import InvoiceStatusAutoRefresh, { InvoiceRefreshFeedback } from "../../../components/invoice-status-auto-refresh";
import Timestamp from "../../../components/timestamp";
import StatusBadge from "../../../components/status-badge";
import StatusRefreshButton from "../../../components/status-refresh-button";
import {
  invoiceStatusLabel,
  invoiceStatusTones,
  type InvoiceStatus,
} from "../../../lib/invoice-status";
import { safeHttpUrl } from "../../../lib/linkify";
import { getI18n } from "../../../lib/i18n/server";
import type { Translate } from "../../../lib/i18n/translate";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("checkout.metaTitle") };
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost"
).replace(/\/+$/, "");


type InvoiceStatusResponse = {
  id: string;
  address: string;
  subaddress_index: number | null;
  amount_xmr: string;
  amount_paid_xmr?: string | null;
  amount_remaining_xmr?: string | null;
  status: InvoiceStatus;
  confirmation_target: number;
  confirmations: number;
  checkout_continue_available?: boolean;
  checking_delayed?: boolean;
  created_at: string;
  expires_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
  btcpay_amount?: string | null;
  btcpay_currency?: string | null;
  btcpay_checkout_style?: "standard" | "btcpay_classic" | null;
  btcpay_redirect_url?: string | null;
  btcpay_redirect_automatically?: boolean | null;
  btcpay_order_id?: string | null;
  btcpay_order_number?: string | null;
  qr_logo?: "monero" | "none" | "custom" | null;
  qr_logo_data_url?: string | null;
  quote?: {
    fiat_amount: string;
    fiat_currency: string;
    rate: string;
    source: string;
    quoted_at: string;
  } | null;
};
type SystemStatusResponse = {
  wallet_rpc: "ok" | "unreachable";
  daemon: "ok" | "unreachable" | "unknown";
  reconciler: "ok" | "degraded" | "unavailable";
};

const awaitingPaymentStatuses: InvoiceStatus[] = [
  "pending",
  "partially_paid",
  "payment_detected",
];

const paymentCheckNotice = (
  systemStatus: SystemStatusResponse | null,
  invoice: InvoiceStatusResponse,
  t: Translate,
) => {
  if (!awaitingPaymentStatuses.includes(invoice.status)) {
    return null;
  }
  // The reconciler state is shared by all merchants, so only this invoice's
  // own check status decides whether its checks are delayed.
  const checkingWorks =
    systemStatus?.wallet_rpc === "ok" &&
    systemStatus.daemon !== "unreachable" &&
    invoice.checking_delayed !== true;
  if (checkingWorks) {
    return {
      delayed: false,
      text: "",
    };
  }
  return {
    delayed: true,
    text: t("checkout.checkingDelayed"),
  };
};

export default async function BtcpayModalInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const { t } = await getI18n();
  const [response, systemStatusResponse] = await Promise.all([
    fetch(
      `${apiBaseUrl}/api/core/public/invoice/${encodeURIComponent(invoiceId)}`,
      {
        cache: "no-store",
      },
    ).catch(() => new Response(null, { status: 503 })),
    fetch(`${apiBaseUrl}/api/core/public/system/status`, { cache: "no-store" }).catch(() => new Response(null, { status: 503 })),
  ]);

  const invoice = response.ok
    ? (await response.json().catch(() => null)) as InvoiceStatusResponse | null
    : null;
  const retrievedAt = invoice ? new Date().toISOString() : undefined;
  const statusMessage = invoice
    ? t("checkout.statusAnnouncement", {
        status: invoiceStatusLabel(invoice.status, invoice.amount_paid_xmr, invoice.amount_remaining_xmr, t),
        confirmations: invoice.confirmations,
        target: invoice.confirmation_target,
      })
    : "";

  if (response.status === 404 || response.status === 422) {
    return <><BtcpayModalBridge invoiceId={invoiceId} status="invalid" /><MissingBuyerLink kind="compact" invalid={response.status === 422} /></>;
  }

  if (!response.ok || !invoice) {
    return (
      <InvoiceStatusAutoRefresh
      key={invoiceId}
      retrievedAt={retrievedAt}
      error={!invoice}
      statusMessage={statusMessage}
      status={invoice?.status}
    >
      <main id="main-content" tabIndex={-1} className="grid min-h-screen place-items-center bg-cream px-3 py-6 text-ink sm:px-6">
        <InvoiceRefreshFeedback />
        <section className="w-full max-w-lg overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <header className="bg-ink px-6 py-5 text-cream">
            <p className="flex items-center gap-2 text-sm font-semibold text-cream/70">
              <span
                className="h-2.5 w-2.5 rounded-full bg-monero"
                aria-hidden="true"
              />
              {t("checkout.eyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold">{t("checkout.statusUnavailable")}</h1>
          </header>
          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-ink-soft">
              {t("checkout.loadFailed")}
            </p>
          </div>
        </section>
      </main>
    </InvoiceStatusAutoRefresh>
    );
  }

  const systemStatus = systemStatusResponse.ok
    ? ((await systemStatusResponse.json().catch(() => null)) as SystemStatusResponse | null)
    : null;
  const statusLabel = invoiceStatusLabel(
    invoice.status,
    invoice.amount_paid_xmr,
    invoice.amount_remaining_xmr,
    t,
  );
  const confirmations = Math.max(0, invoice.confirmations ?? 0);
  const confirmationTarget = Math.max(0, invoice.confirmation_target);
  const hasDetectedPayment =
    invoice.status === "payment_detected" || invoice.status === "confirmed";
  const createdTimestamp = invoice.created_at;
  const expiresTimestamp = invoice.expires_at;
  const checkNotice = paymentCheckNotice(systemStatus, invoice, t);
  const isBtcpayInvoice = Boolean(
    invoice.btcpay_amount && invoice.btcpay_currency,
  );
  const useClassicCheckout =
    isBtcpayInvoice && invoice.btcpay_checkout_style === "btcpay_classic";
  const isConfirmed = invoice.status === "confirmed";
  const returnUrl = safeHttpUrl(invoice.btcpay_redirect_url);
  const receiptHref = `/i/${encodeURIComponent(invoiceId)}/receipt`;
  const invoicePageUrl = `${siteUrl}/i/${encodeURIComponent(invoiceId)}`;
  const checkoutContinueAvailable =
    !isBtcpayInvoice &&
    invoice.status === "confirmed" &&
    Boolean(invoice.checkout_continue_available);

  return (
    <InvoiceStatusAutoRefresh
      key={invoiceId}
      retrievedAt={retrievedAt}
      error={!invoice}
      statusMessage={statusMessage}
      status={invoice?.status}
    >
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-cream px-3 py-4 text-ink sm:px-6 sm:py-6">

      <BtcpayModalBridge invoiceId={invoiceId} status={invoice.status} />
      {useClassicCheckout ? (
        <div className="mx-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)] gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3 px-1">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-monero"
                  aria-hidden="true"
                />
                {t("checkout.eyebrow")}
              </p>
              <h1 className="mt-1 font-sans text-xl font-semibold text-ink">
                {t("checkout.paymentRequest")}
              </h1>
            </div>
            <StatusRefreshButton />
          </div>
          <BtcpayClassicCheckout
            invoiceId={invoiceId}
            address={invoice.address}
            amountXmr={invoice.amount_xmr}
            amountPaidXmr={invoice.amount_paid_xmr ?? null}
            amountRemainingXmr={invoice.amount_remaining_xmr ?? null}
            btcpayAmount={invoice.btcpay_amount ?? null}
            btcpayCurrency={invoice.btcpay_currency ?? null}
            quote={invoice.quote ?? null}
            expiresAt={invoice.expires_at}
            expiryRetrievedAt={retrievedAt}
            status={invoice.status}
            confirmationTarget={confirmationTarget}
            confirmations={confirmations}
            redirectUrl={returnUrl}
            redirectAutomatically={
              invoice.btcpay_redirect_automatically ?? null
            }
            orderId={invoice.btcpay_order_id ?? null}
            orderNumber={invoice.btcpay_order_number ?? null}
            qrLogoMode={invoice.qr_logo ?? "monero"}
            qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-1">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-monero"
                  aria-hidden="true"
                />
                {t("checkout.eyebrow")}
              </p>
              <h1 className="mt-1 font-sans text-xl font-semibold text-ink">
                {t("checkout.paymentRequest")}
              </h1>
            </div>
            <StatusRefreshButton />
          </div>

          <InvoicePaymentDetails
            address={invoice.address}
            amount={invoice.amount_xmr}
            amountPaid={invoice.amount_paid_xmr ?? null}
            amountRemaining={invoice.amount_remaining_xmr ?? null}
            hasDetectedPayment={hasDetectedPayment}
            expiresAt={invoice.expires_at}
            expiryRetrievedAt={retrievedAt}
            status={invoice.status}
            confirmationTarget={confirmationTarget}
            confirmations={confirmations}
            qrLogoMode={invoice.qr_logo ?? "monero"}
            qrLogoDataUrl={invoice.qr_logo_data_url ?? null}
            quote={invoice.quote ?? null}
          />

          <section className="mt-4 overflow-hidden rounded-surface border border-stroke bg-card shadow-soft">
            <div className="grid divide-y divide-stroke sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-ink-soft">{t("checkout.status")}</p>
                <StatusBadge
                  className="mt-2"
                  label={statusLabel}
                  tone={invoiceStatusTones[invoice.status]}
                />
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-ink-soft">
                  {t("checkout.confirmations")}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {confirmations}/{confirmationTarget}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-ink-soft">{t("checkout.expires")}</p>
                <p
                  className="mt-2 text-sm font-semibold"
                >
                  <Timestamp value={expiresTimestamp} />
                </p>
              </div>
            </div>
            <div className="grid gap-2 border-t border-stroke px-5 py-4">
              {checkNotice?.delayed ? (
                <p
                  className={
                    checkNotice.delayed
                      ? "border-l-2 border-amber-400 pl-3 text-sm text-ink"
                      : "text-sm text-ink-soft"
                  }
                >
                  {checkNotice.text}
                </p>
              ) : null}
              {checkNotice ? (
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                  <p>{t("checkout.saveLink")}</p>
                  <CopyIconButton value={invoicePageUrl} label={t("checkout.pageLinkLabel")} />
                </div>
              ) : null}
              <p className="text-xs text-ink-soft">
                {t("checkout.created")} <Timestamp value={createdTimestamp} />
              </p>
            </div>
            {checkoutContinueAvailable ? (
              <div className="border-t border-stroke bg-sand/50 px-5 py-4">
                <a
                  className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                  href={`/api/core/public/invoice/${encodeURIComponent(invoiceId)}/continue`}
                  rel="noreferrer"
                >
                  {t("checkout.continueToMerchant")}
                </a>
              </div>
            ) : null}
          </section>

          {isConfirmed ? (
            <div className="mt-6 grid gap-3">
              <a
                className={
                  checkoutContinueAvailable
                    ? "inline-flex items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                    : "inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                }
                href={receiptHref}
              >
                {t("checkout.viewReceipt")}
              </a>
              {isBtcpayInvoice && returnUrl ? (
                <a
                  className="inline-flex items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                  href={returnUrl}
                  target="_top"
                  rel="noreferrer"
                >
                  {t("checkout.returnToStore")}
                </a>
              ) : null}
            </div>
          ) : null}
          {(invoice.status === "expired" || invoice.status === "invalid") && isBtcpayInvoice && returnUrl ? (
            <div className="mt-6 grid gap-3">
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
                href={returnUrl}
                target="_top"
                rel="noreferrer"
              >
                {t("checkout.returnToStore")}
              </a>
            </div>
          ) : null}
        </div>
      )}
    </main>
    </InvoiceStatusAutoRefresh>
  );
}
