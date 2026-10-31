"use client";

import { invoiceContext } from "../lib/invoice-display";

import SimulatedCheckoutPreview from "./simulated-checkout-preview";
import DiagnosticReference from "./diagnostic-reference";
import PendingSubmitButton from "./pending-submit-button";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { formatUsdAmount, formatXmrAmount } from "../lib/formatting";
import { useXmrUsdRate } from "../lib/use-xmr-usd-rate";
import { useXmrFiatRate } from "../lib/use-xmr-fiat-rate";
import { useBrowserOrigin } from "../lib/use-browser-origin";
import {
  FIAT_CURRENCY_SUGGESTIONS,
  getCurrencyFlag,
} from "../lib/fiat-currencies";
import AccessibleDialog from "./accessible-dialog";
import StatusBadge, { type StatusTone } from "./status-badge";

import {
  createInvoiceAction,
  createInvoiceTourAction,
  archiveInvoiceAction,
  archiveInvoiceTourAction,
  type ArchiveInvoiceState,
  type InvoiceState,
} from "../app/(app)/dashboard/actions";

type InvoiceItem = {
  id: string;
  address: string;
  subaddress_index?: number | null;
  amount_xmr: string;
  status: "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
  confirmation_target: number;
  confirmations?: number | null;
  paid_after_expiry?: boolean;
  paid_after_expiry_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  archived_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
  expires_at: string | null;
};

type InvoicePanelProps = {
  mode?: "live" | "tour";
  basePath?: string;
  activeInvoices: InvoiceItem[];
  includeArchived: boolean;
  searchQuery: string;
  statusFilter: InvoiceItem["status"] | "active" | "all";
  sort: string;
  order: string;
  defaultConfirmationTarget: number;
  page?: number;
  pageSize?: number;
  total?: number;
};

const initialState: InvoiceState = {
  error: null,
  invoiceId: null,
  address: null,
  amount: null,
  recipientName: null,
  description: null,
  subaddressIndex: null,
  warnings: null,
};

const initialArchiveState: ArchiveInvoiceState = {
  error: null,
  success: null,
  archivedId: null,
};

const formatStatus = (status: InvoiceItem["status"]) => {
  if (status === "payment_detected") {
    return "Payment detected";
  }
  if (status === "pending") {
    return "Awaiting funds";
  }
  if (status === "confirmed") {
    return "Confirmed";
  }
  if (status === "invalid") {
    return "Invalid";
  }
  return "Expired";
};

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
};

const invoiceStatusOptions: {
  value: InvoiceItem["status"] | "active" | "all";
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  { value: "pending", label: "Awaiting funds" },
  { value: "payment_detected", label: "Detected" },
  { value: "confirmed", label: "Confirmed" },
  { value: "expired", label: "Expired" },
  { value: "invalid", label: "Invalid" },
];

type CreateInvoiceModalProps = {
  mode: "live" | "tour";
  defaultConfirmationTarget: number;
  onClose: () => void;
};

type CreateInvoiceAction = (
  prevState: InvoiceState,
  formData: FormData,
) => Promise<InvoiceState>;

function CreateInvoiceModal({
  mode,
  defaultConfirmationTarget,
  onClose,
}: CreateInvoiceModalProps) {
  const router = useRouter();
  const action: CreateInvoiceAction =
    mode === "tour" ? createInvoiceTourAction : createInvoiceAction;
  const [state, formAction] = useFormState(action, initialState);
  const [amount, setAmount] = useState("");
  const [demoPreview, setDemoPreview] = useState(false);
  useEffect(() => { if (demoPreview) document.getElementById("demo-ready")?.focus(); }, [demoPreview]);
  const [amountMode, setAmountMode] = useState<"xmr" | "fiat">("xmr");
  const [fiatCurrency, setFiatCurrency] = useState("USD");
  const [confirmationMode, setConfirmationMode] = useState<
    "account_default" | "custom"
  >("account_default");
  const [confirmationTarget, setConfirmationTarget] = useState(
    String(defaultConfirmationTarget ?? 10),
  );
  const [expiryMode, setExpiryMode] = useState<"default" | "custom">("default");
  const [expiresDate, setExpiresDate] = useState("");
  const [expiresTime, setExpiresTime] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [description, setDescription] = useState("");
  const [checkoutContinueUrl, setCheckoutContinueUrl] = useState("");
  const [qrLogoMode, setQrLogoMode] = useState<
    "account_default" | "monero" | "none" | "custom"
  >("account_default");
  const [qrLogoDataUrl, setQrLogoDataUrl] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [copiedPublicInvoiceUrl, setCopiedPublicInvoiceUrl] = useState(false);
  const browserOrigin = useBrowserOrigin();
  const createInvoiceOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? browserOrigin;
  const {
    rate: usdRate,
    updatedAt: usdRateUpdatedAt,
    source: usdRateSource,
  } = useXmrUsdRate(mode !== "tour");
  const {
    rate: liveFiatRate,
    updatedAt: fiatRateUpdatedAt,
    status: liveFiatRateStatus,
    source: fiatRateSource,
  } = useXmrFiatRate(mode !== "tour" && amountMode === "fiat" ? fiatCurrency : null);
  const demoRates: Record<string, number> = { USD: 200, EUR: 180, GBP: 160 };
  const fiatRate = mode === "tour" ? demoRates[fiatCurrency] ?? null : liveFiatRate;
  const fiatRateStatus = mode === "tour" ? (fiatRate ? "ready" : "error") : liveFiatRateStatus;

  useEffect(() => {
    if (mode === "tour" || (!state.invoiceId && !state.creationAttemptId)) {
      return;
    }
    router.refresh();
  }, [mode, router, state.invoiceId, state.creationAttemptId]);

  const creationError = state.error ? (
    <div role="alert" className="grid min-w-0 gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <p className="font-semibold">{state.code === "pool_exhausted" ? "No invoice addresses are currently eligible." : state.code === "allocation_contention" ? "Invoice detection is busy. Try again shortly." : state.code === "snapshot_failed" ? "The view-only snapshot failed. An address could not be safely reused." : state.error}</p>
      {state.retryAfterSeconds ? <p>Try again in {state.retryAfterSeconds.toLocaleString()} seconds.</p> : null}
      {state.diagnosticId ? <DiagnosticReference value={state.diagnosticId} /> : null}
      {mode === "live" ? <Link className="font-semibold underline underline-offset-4" href="/dashboard?tab=health">View System health</Link> : null}
    </div>
  ) : null;

  const publicInvoiceUrl = state.invoiceId
    ? createInvoiceOrigin
      ? new URL(`/invoice/${state.invoiceId}`, createInvoiceOrigin).toString()
      : `/invoice/${state.invoiceId}`
    : null;

  const formattedDraftAmount =
    amountMode === "xmr" && amount ? formatXmrAmount(amount) : amount;

  const draftAmountValue = useMemo(() => {
    if (amountMode !== "xmr") {
      return null;
    }
    const parsed = Number.parseFloat(amount);
    return Number.isFinite(parsed) ? parsed : null;
  }, [amount, amountMode]);

  const draftUsdEstimate = useMemo(() => {
    if (!usdRate || draftAmountValue === null || draftAmountValue <= 0) {
      return null;
    }
    return formatUsdAmount(usdRate * draftAmountValue);
  }, [usdRate, draftAmountValue]);

  const fiatAmountValue = useMemo(() => {
    if (amountMode !== "fiat") {
      return null;
    }
    const parsed = Number.parseFloat(amount);
    return Number.isFinite(parsed) ? parsed : null;
  }, [amount, amountMode]);

  const draftXmrEstimate = useMemo(() => {
    if (!fiatRate || fiatAmountValue === null || fiatAmountValue <= 0) {
      return null;
    }
    return fiatAmountValue / fiatRate;
  }, [fiatAmountValue, fiatRate]);

  const showFiatEstimate =
    amountMode === "fiat" && fiatAmountValue !== null && fiatAmountValue > 0;
  const draftXmrEstimateDisplay =
    draftXmrEstimate !== null
      ? formatXmrAmount(draftXmrEstimate.toFixed(draftXmrEstimate >= 1 ? 6 : 8))
      : null;
  const draftXmrEstimateLabel = draftXmrEstimate
    ? `~${draftXmrEstimateDisplay} XMR`
    : fiatRateStatus === "loading"
      ? "Fetching estimate..."
      : "Estimate unavailable";
  const usdEstimateMeta =
    usdRateSource === "coingecko"
      ? "CoinGecko spot rate"
      : "external spot rate";
  const usdEstimateTime = usdRateUpdatedAt
    ? new Date(usdRateUpdatedAt).toLocaleString()
    : null;
  const fiatEstimateMeta = mode === "tour" ? "Simulated demo rate (not a market rate)" :
    fiatRateSource === "coingecko"
      ? "CoinGecko spot rate"
      : "external spot rate";
  const fiatEstimateTime = fiatRateUpdatedAt
    ? new Date(fiatRateUpdatedAt).toLocaleString()
    : null;
  const fiatCurrencyFlag = getCurrencyFlag(fiatCurrency);
  const fiatCurrencyLabel = fiatCurrencyFlag
    ? `${fiatCurrencyFlag} ${fiatCurrency}`
    : fiatCurrency;

  const expiryTimeValue = expiresTime || "00:00";
  const expiryValue = expiresDate ? `${expiresDate}T${expiryTimeValue}` : "";
  const expiryIsValid =
    expiryMode !== "custom" || (!expiresTime && !expiresDate) || !!expiresDate;
  const isFiatCurrencyValid =
    amountMode !== "fiat" || Boolean(fiatCurrency.trim()) && (mode !== "tour" || Boolean(fiatRate));

  const handleQrLogoFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      setQrLogoDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setQrLogoDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };
  const handleCopyPublicInvoiceUrl = async () => {
    if (!publicInvoiceUrl) {
      return;
    }
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(publicInvoiceUrl);
      setCopiedPublicInvoiceUrl(true);
      window.setTimeout(() => setCopiedPublicInvoiceUrl(false), 2000);
    } catch {
      setCopiedPublicInvoiceUrl(false);
      setCopyFailed(true);
    }
  };

  const labelClass =
    "text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft";
  const inputClass =
    "w-full min-w-0 rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10";
  const primaryButton =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";
  const secondaryButton =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";
  const smallSecondaryButton =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stroke bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

  const createDisabled =
    !amount || Number(amount) <= 0 ||
    !isFiatCurrencyValid ||
    (confirmationMode === "custom" && !confirmationTarget) ||
    !expiryIsValid ||
    (qrLogoMode === "custom" && !qrLogoDataUrl);

  return (
    <AccessibleDialog
      ariaLabelledBy="create-invoice-title"
      initialFocusSelector="#wizard_amount_mode"
      onClose={onClose}
      panelClassName="max-h-[calc(100dvh-0.75rem)] max-w-3xl rounded-t-[1.2rem] bg-cream sm:max-h-[85vh] sm:rounded-surface"
    >
        <span className="sr-only" role="status" aria-live="polite">
          {copiedPublicInvoiceUrl ? "Invoice link copied to clipboard" : state.invoiceId ? "Invoice created" : ""}
        </span>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stroke px-5 py-5 sm:px-7 sm:py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
              Create invoice
            </p>
            <h2
              className="mt-1 font-sans text-xl font-semibold sm:text-2xl"
              id="create-invoice-title"
            >
              Create a new invoice
            </h2>
            {mode === "tour" ? (
              <p className="mt-2 text-sm font-semibold text-ink-soft">
                Tour mode: preview a simulated invoice. Nothing is saved.
              </p>
            ) : null}
          </div>
          <button className={secondaryButton} type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form
          className="grid gap-6 px-5 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6"
          action={formAction}
          onSubmit={mode === "tour" ? event => { event.preventDefault(); if (!createDisabled && Number(amount) > 0) setDemoPreview(true); } : undefined}
        >
          {demoPreview ? (
            <div className="grid min-h-0 gap-4 overflow-y-auto">
              <p id="demo-ready" tabIndex={-1} role="status" className="font-semibold text-emerald-800">Simulated invoice ready. Nothing was saved.</p>
              <SimulatedCheckoutPreview amount={amountMode === "fiat" ? (Number(amount) / (fiatRate || 1)).toFixed(12) : amount} target={Number(confirmationMode === "custom" ? confirmationTarget : defaultConfirmationTarget)} description={description} expiry={expiryMode === "custom" ? expiryValue || "Custom date not set" : "60 minutes"} />
              <button type="button" className={secondaryButton} onClick={onClose}>Done</button>
            </div>
          ) : state.invoiceId ? (
            <div className="grid gap-4">
              {publicInvoiceUrl ? (
                <div className="rounded-2xl border border-stroke bg-cream/70 p-5 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Invoice created
                  </p>
                  <p className="mt-3 text-sm text-ink">
                    Share this invoice link with your customer:
                  </p>
                  {state.amount ? (
                    <div className="mt-4 rounded-xl border border-stroke bg-ink/5 px-4 py-3">
                      <p className={labelClass}>Invoice amount</p>
                      <p className="mt-1 font-mono text-lg font-semibold text-ink">
                        {formatXmrAmount(state.amount)} XMR
                      </p>
                      <p className="mt-1 text-sm text-ink-soft">
                        The invoice is defined in XMR. Any fiat input was used
                        only to estimate this amount at creation time.
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm font-semibold text-ink">
                    <Link
                      className="underline underline-offset-4"
                      href={publicInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {publicInvoiceUrl}
                    </Link>
                  </p>
                  {copyFailed ? <p role="alert" className="break-all text-sm text-red-700">Could not copy. Select and copy the text manually.</p> : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className={secondaryButton}
                      type="button"
                      onClick={handleCopyPublicInvoiceUrl}
                    >
                      {copiedPublicInvoiceUrl ? "Copied link" : "Copy link"}
                    </button>
                    <Link
                      className={primaryButton}
                      href={publicInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open invoice
                    </Link>
                  </div>
                  {state.warnings && state.warnings.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {state.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {creationError}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  className={secondaryButton}
                  type="button"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="pr-1">
                <div className="grid gap-6">
                  <div className="grid gap-4">
                    <div>
                      <p className={labelClass}>Amount</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        Define the invoice amount in XMR, or use an
                        informational fiat reference.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <label
                        className={labelClass}
                        htmlFor="wizard_amount_mode"
                      >
                        Amount type
                      </label>
                      <select
                        className={inputClass}
                        id="wizard_amount_mode"
                        name="amount_mode"
                        value={amountMode}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "xmr" || value === "fiat") {
                            setAmountMode(value);
                            setAmount("");
                          }
                        }}
                      >
                        <option value="xmr">XMR</option>
                        <option value="fiat">Fiat reference</option>
                      </select>
                    </div>

                    {amountMode === "xmr" ? (
                      <div className="grid gap-2">
                        <label
                          className={labelClass}
                          htmlFor="wizard_amount_xmr"
                        >
                          Amount (XMR)
                        </label>
                        <input
                          className={inputClass}
                          id="wizard_amount_xmr"
                          name="amount_xmr"
                          type="number"
                          step="0.000001"
                          min="0"
                          placeholder="0.10"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          required
                        />
                        {draftUsdEstimate ? (
                          <details className="w-fit text-xs text-ink-soft">
                            <summary className="cursor-pointer select-none underline underline-offset-4">
                              Approx. USD reference: ~{draftUsdEstimate}
                            </summary>
                            <p className="mt-2 max-w-[46ch] leading-relaxed">
                              Reference only, uses {usdEstimateMeta}
                              {usdEstimateTime
                                ? ` from ${usdEstimateTime}`
                                : ""}
                              . Not a quote or guarantee.
                            </p>
                          </details>
                        ) : null}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                        <div className="grid gap-2">
                          <label
                            className={labelClass}
                            htmlFor="wizard_amount_fiat"
                          >
                            Amount (fiat)
                          </label>
                          <input
                            className={inputClass}
                            id="wizard_amount_fiat"
                            name="amount_fiat"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="100.00"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <label
                            className={labelClass}
                            htmlFor="wizard_currency"
                          >
                            Currency
                          </label>
                          <input
                            className={inputClass}
                            id="wizard_currency"
                            name="currency"
                            type="text"
                            placeholder="USD"
                            list="wizard-fiat-currency-options"
                            value={fiatCurrency}
                            onChange={(event) =>
                              setFiatCurrency(event.target.value.toUpperCase())
                            }
                            required
                          />
                        </div>
                        <datalist id="wizard-fiat-currency-options">
                          {(mode === "tour" ? ["USD", "EUR", "GBP"] : FIAT_CURRENCY_SUGGESTIONS).map((code) => (
                            <option
                              key={code}
                              value={code}
                              label={`${getCurrencyFlag(code) ?? ""} ${code}`.trim()}
                            />
                          ))}
                        </datalist>
                        <p className="text-sm text-ink-soft sm:col-span-2">
                          {mode === "tour" ? "Demo only: USD 200, EUR 180, or GBP 160 per XMR. These fixed simulated rates are not market quotes. Other currencies are unavailable in this demo." : "Fiat inputs create an XMR invoice using an informational rate at request time. The invoice is stored and checked in XMR."}
                        </p>
                        {showFiatEstimate ? (
                          <details className="w-fit text-xs text-ink-soft sm:col-span-2">
                            <summary className="cursor-pointer select-none underline underline-offset-4">
                              Approx. XMR value: {draftXmrEstimateLabel}
                              {fiatCurrencyFlag
                                ? ` · ${fiatCurrencyLabel}`
                                : ""}
                            </summary>
                            <p className="mt-2 max-w-[46ch] leading-relaxed">
                              Reference only, uses {fiatEstimateMeta}
                              {fiatEstimateTime
                                ? ` from ${fiatEstimateTime}`
                                : ""}
                              . Not a quote or guarantee.
                            </p>
                          </details>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <details className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                    <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
                      Confirmation and expiry
                    </summary>
                    <div className="mt-4 grid gap-5">
                      <div className="grid gap-3">
                        <p className={labelClass}>Confirmations</p>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
                          <div className="grid gap-2">
                            <label
                              className={labelClass}
                              htmlFor="wizard_confirmation_mode"
                            >
                              Mode
                            </label>
                            <select
                              className={inputClass}
                              id="wizard_confirmation_mode"
                              value={confirmationMode}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (
                                  value === "account_default" ||
                                  value === "custom"
                                ) {
                                  setConfirmationMode(value);
                                }
                              }}
                            >
                              <option value="account_default">
                                Account default ({defaultConfirmationTarget})
                              </option>
                              <option value="custom">Custom</option>
                            </select>
                          </div>
                          {confirmationMode === "custom" ? (
                            <div className="grid gap-2">
                              <label
                                className={labelClass}
                                htmlFor="wizard_confirmation_target"
                              >
                                Target
                              </label>
                              <input
                                className={inputClass}
                                id="wizard_confirmation_target"
                                name="confirmation_target"
                                type="number"
                                min="0"
                                max="10"
                                step="1"
                                value={confirmationTarget}
                                onChange={(event) =>
                                  setConfirmationTarget(event.target.value)
                                }
                                required
                              />
                            </div>
                          ) : null}
                        </div>
                        {confirmationMode === "custom" ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              className={smallSecondaryButton}
                              type="button"
                              onClick={() => setConfirmationTarget("0")}
                            >
                              0 confirmations
                            </button>
                            <p className="text-sm text-ink-soft">
                              Create the invoice with a custom confirmation
                              target.
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-3">
                        <p className={labelClass}>Expiry</p>
                        <div className="grid gap-2">
                          <label
                            className={labelClass}
                            htmlFor="wizard_expiry_mode"
                          >
                            Mode
                          </label>
                          <select
                            className={inputClass}
                            id="wizard_expiry_mode"
                            value={expiryMode}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "default" || value === "custom") {
                                setExpiryMode(value);
                                if (value === "default") {
                                  setExpiresDate("");
                                  setExpiresTime("");
                                }
                              }
                            }}
                          >
                            <option value="default">
                              Default (60 minutes)
                            </option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>

                        {expiryMode === "custom" ? (
                          <div className="grid gap-2">
                            <label
                              className={labelClass}
                              htmlFor="wizard_expires_date"
                            >
                              Expiry date
                            </label>
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                              <input
                                className={inputClass}
                                id="wizard_expires_date"
                                name="expires_date"
                                type="date"
                                value={expiresDate}
                                onChange={(event) =>
                                  setExpiresDate(event.target.value)
                                }
                              />
                              <input
                                className={inputClass}
                                id="wizard_expires_time"
                                name="expires_time"
                                type="time"
                                value={expiresTime}
                                onChange={(event) =>
                                  setExpiresTime(event.target.value)
                                }
                              />
                            </div>
                            <input
                              type="hidden"
                              name="expires_at"
                              value={expiryValue}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </details>

                  <details className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                    <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
                      Customer display
                    </summary>
                    <div className="mt-4 grid gap-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <label
                            className={labelClass}
                            htmlFor="wizard_recipient"
                          >
                            Recipient name
                          </label>
                          <input
                            className={inputClass}
                            id="wizard_recipient"
                            name="recipient_name"
                            type="text"
                            placeholder="Your store"
                            value={recipientName}
                            onChange={(event) =>
                              setRecipientName(event.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <label
                            className={labelClass}
                            htmlFor="wizard_description"
                          >
                            Description
                          </label>
                          <input
                            className={inputClass}
                            id="wizard_description"
                            name="description"
                            type="text"
                            placeholder="Order 1042"
                            value={description}
                            onChange={(event) =>
                              setDescription(event.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label
                          className={labelClass}
                          htmlFor="wizard_checkout_continue_url"
                        >
                          Continue URL
                        </label>
                        <input
                          className={inputClass}
                          id="wizard_checkout_continue_url"
                          name="checkout_continue_url"
                          type="url"
                          placeholder="https://merchant.example/thanks"
                          value={checkoutContinueUrl}
                          onChange={(event) =>
                            setCheckoutContinueUrl(event.target.value)
                          }
                        />
                        <p className="text-sm text-ink-soft">
                          After confirmation, the hosted invoice page can show a
                          Continue button.
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <label
                          className={labelClass}
                          htmlFor="wizard_qr_logo_mode"
                        >
                          QR logo
                        </label>
                        <select
                          className={inputClass}
                          id="wizard_qr_logo_mode"
                          name="qr_logo_mode"
                          value={qrLogoMode}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (
                              value === "account_default" ||
                              value === "monero" ||
                              value === "none" ||
                              value === "custom"
                            ) {
                              setQrLogoMode(value);
                            }
                            if (value !== "custom") {
                              setQrLogoDataUrl(null);
                            }
                          }}
                        >
                          <option value="account_default">
                            Account default
                          </option>
                          <option value="monero">Monero logo</option>
                          <option value="none">No logo</option>
                          <option value="custom">Custom image</option>
                        </select>
                        <input
                          type="hidden"
                          name="qr_logo_data_url"
                          value={
                            qrLogoMode === "custom" ? (qrLogoDataUrl ?? "") : ""
                          }
                        />
                        {qrLogoMode === "custom" ? (
                          <input
                            className="w-full min-w-0 rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink"
                            id="wizard_qr_logo_file"
                            type="file"
                            accept="image/*"
                            onChange={handleQrLogoFileChange}
                          />
                        ) : null}
                        {qrLogoMode === "custom" && qrLogoDataUrl ? (
                          <button
                            className={secondaryButton}
                            type="button"
                            onClick={() => setQrLogoDataUrl(null)}
                          >
                            Remove custom image
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </details>

                  <div className="rounded-2xl border border-stroke bg-white/70 p-5 text-sm text-ink shadow-soft">
                    <p className={labelClass}>Summary</p>
                    <p className="mt-2">
                      Amount: <strong>{formattedDraftAmount || "-"}</strong>{" "}
                      {amountMode === "xmr" ? "XMR" : fiatCurrencyLabel}
                    </p>
                    <p className="mt-2">
                      Confirmation target:{" "}
                      <strong>
                        {confirmationMode === "custom"
                          ? confirmationTarget || "-"
                          : defaultConfirmationTarget}
                      </strong>
                    </p>
                    <p className="mt-2">
                      Expiry:{" "}
                      <strong>
                        {expiryMode === "custom"
                          ? expiryValue || "Custom date not set"
                          : "Default (60 minutes)"}
                      </strong>
                    </p>
                    {amountMode === "fiat" ? (
                      <p className="mt-2 text-sm text-ink-soft">
                        XMR invoice estimate:{" "}
                        <strong>{draftXmrEstimateLabel}</strong>
                      </p>
                    ) : null}
                  </div>

                  {creationError}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-stroke pt-4">
                <button
                  className={secondaryButton}
                  type="button"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <PendingSubmitButton
                  className={primaryButton}
                  pendingLabel="Creating invoice…"
                  disabled={createDisabled}
                >
                  Create invoice
                </PendingSubmitButton>
              </div>
            </>
          )}
        </form>
    </AccessibleDialog>
  );
}

export default function InvoicePanel({
  mode = "live",
  basePath = "/dashboard",
  activeInvoices,
  includeArchived,
  searchQuery,
  statusFilter,
  sort,
  order,
  defaultConfirmationTarget,
  page = 1,
  pageSize = 25,
  total = activeInvoices.length,
}: InvoicePanelProps) {
  const router = useRouter();
  const normalizedBasePath = basePath.replace(/\/+$/, "") || "/";
  const [archiveState, archiveAction] = useFormState(
    mode === "tour" ? archiveInvoiceTourAction : archiveInvoiceAction,
    initialArchiveState,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createModalKey, setCreateModalKey] = useState(0);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(
    null,
  );
  const [archiveModalInvoiceId, setArchiveModalInvoiceId] = useState<
    string | null
  >(null);
  const normalizedSearchQuery = searchQuery ?? "";
  const [searchDraft, setSearchDraft] = useState({
    source: normalizedSearchQuery,
    value: normalizedSearchQuery,
  });
  if (searchDraft.source !== normalizedSearchQuery) {
    setSearchDraft({
      source: normalizedSearchQuery,
      value: normalizedSearchQuery,
    });
  }
  const searchInput =
    searchDraft.source === normalizedSearchQuery
      ? searchDraft.value
      : normalizedSearchQuery;

  const activeList = useMemo(() => {
    if (mode !== "tour") {
      return activeInvoices;
    }
    const normalizedQuery = (searchQuery ?? "").trim().toLowerCase();
    let list = [...activeInvoices];
    if (normalizedQuery) {
      list = list.filter((invoice) => {
        const metadataValues = invoice.metadata
          ? Object.entries(invoice.metadata).flatMap(([key, value]) => [
              key,
              value,
              `${key}:${value}`,
            ])
          : [];
        const haystack = [
          invoice.id,
          invoice.address,
          invoice.amount_xmr,
          invoice.status,
          String(invoice.subaddress_index ?? ""),
          ...metadataValues,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }
    if (statusFilter !== "all" && statusFilter !== "active") {
      list = list.filter((invoice) => invoice.status === statusFilter);
    }
    if (statusFilter === "active") {
      list = list.filter((invoice) =>
        ["pending", "payment_detected", "confirmed"].includes(invoice.status),
      );
    }

    const statusRank: Record<InvoiceItem["status"], number> = {
      pending: 0,
      payment_detected: 1,
      confirmed: 2,
      expired: 3,
      invalid: 4,
    };

    const compare = (a: InvoiceItem, b: InvoiceItem) => {
      if (sort === "amount_xmr") {
        const left = Number.parseFloat(a.amount_xmr);
        const right = Number.parseFloat(b.amount_xmr);
        const diff =
          (Number.isFinite(left) ? left : 0) -
          (Number.isFinite(right) ? right : 0);
        return diff || a.id.localeCompare(b.id);
      }
      if (sort === "status") {
        const diff = statusRank[a.status] - statusRank[b.status];
        return diff || a.id.localeCompare(b.id);
      }
      if (sort === "confirmations") {
        const diff = (a.confirmations ?? 0) - (b.confirmations ?? 0);
        return diff || a.id.localeCompare(b.id);
      }
      if (sort === "confirmation_target") {
        const diff = a.confirmation_target - b.confirmation_target;
        return diff || a.id.localeCompare(b.id);
      }
      if (sort === "expires_at") {
        const left = a.expires_at ? new Date(a.expires_at).getTime() : 0;
        const right = b.expires_at ? new Date(b.expires_at).getTime() : 0;
        const diff =
          (Number.isFinite(left) ? left : 0) -
          (Number.isFinite(right) ? right : 0);
        return diff || a.id.localeCompare(b.id);
      }
      const left = new Date(a.created_at).getTime();
      const right = new Date(b.created_at).getTime();
      const diff =
        (Number.isFinite(left) ? left : 0) -
        (Number.isFinite(right) ? right : 0);
      return diff || a.id.localeCompare(b.id);
    };

    list.sort(compare);
    if (order === "desc") {
      list.reverse();
    }
    return list;
  }, [activeInvoices, mode, order, searchQuery, sort, statusFilter]);

  const buildInvoicesHref = (next: {
    q?: string;
    sort?: string;
    order?: string;
    includeArchived?: boolean;
    status?: InvoiceItem["status"] | "active" | "all";
    page?: number;
  }) => {
    const params = new URLSearchParams();
    params.set("tab", "invoices");
    const nextArchived = next.includeArchived ?? includeArchived;
    if (nextArchived) {
      params.set("archived", "1");
    }
    const nextQuery = (next.q ?? searchQuery ?? "").trim();
    if (nextQuery) {
      params.set("q", nextQuery);
    }
    const nextStatus = next.status ?? statusFilter;
    if (nextStatus && nextStatus !== "all") {
      params.set("status", nextStatus);
    }
    const nextSort = next.sort ?? sort;
    if (nextSort) {
      params.set("sort", nextSort);
    }
    const nextOrder = next.order ?? order;
    if (nextOrder) {
      params.set("order", nextOrder);
    }
    const nextPage = next.page ?? 1;
    if (nextPage > 1) {
      params.set("page", nextPage.toString());
    }
    return `${normalizedBasePath}?${params.toString()}`;
  };
  const archivedToggleHref = buildInvoicesHref({
    includeArchived: !includeArchived,
    status: includeArchived ? "active" : "all",
  });

  const csvExportHref = (() => {
    if (mode === "tour") {
      return null;
    }
    const params = new URLSearchParams();
    if (includeArchived) {
      params.set("include_archived", "true");
    }
    const trimmed = (searchQuery ?? "").trim();
    if (trimmed) {
      params.set("q", trimmed);
    }
    if (statusFilter === "active") {
      params.set("active_only", "true");
    } else if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (sort) {
      params.set("sort", sort);
    }
    if (order) {
      params.set("order", order);
    }
    const suffix = params.toString();
    return suffix
      ? `${normalizedBasePath}/invoices.csv?${suffix}`
      : `${normalizedBasePath}/invoices.csv`;
  })();

  const openCreate = () => {
    setIsCreateOpen(true);
    setCreateModalKey((prev) => prev + 1);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
  };

  const toggleInvoice = (invoiceId: string) => {
    setExpandedInvoiceId((prev) => (prev === invoiceId ? null : invoiceId));
  };

  const openArchiveModal = (invoiceId: string) => {
    setArchiveModalInvoiceId(invoiceId);
  };

  const closeArchiveModal = () => {
    setArchiveModalInvoiceId(null);
  };

  useEffect(() => {
    if (
      archiveState.archivedId &&
      expandedInvoiceId === archiveState.archivedId
    ) {
      const timeoutId = window.setTimeout(() => {
        setExpandedInvoiceId(null);
        setArchiveModalInvoiceId(null);
        if (mode !== "tour") {
          router.refresh();
        }
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [archiveState.archivedId, expandedInvoiceId, mode, router]);

  const labelClass =
    "text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft";
  const inputClass =
    "w-full min-w-0 rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10";
  const primaryButton =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";
  const secondaryButton =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";
  const smallSecondaryButton =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stroke bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

  const sortHref = (key: string) => {
    const nextOrder = sort === key && order === "asc" ? "desc" : "asc";
    return buildInvoicesHref({ sort: key, order: nextOrder });
  };
  const sortIndicator = (key: string) => {
    if (sort !== key) {
      return "";
    }
    return order === "asc" ? " (asc)" : " (desc)";
  };
  const statusTone = (status: InvoiceItem["status"]): StatusTone => {
    if (status === "payment_detected") {
      return "detected";
    }
    if (status === "confirmed") {
      return "success";
    }
    if (status === "expired" || status === "invalid") {
      return "error";
    }
    return "pending";
  };

  const applySearch = () => {
    router.push(buildInvoicesHref({ q: searchInput }));
  };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const resultStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const resultEnd = Math.min(page * pageSize, total);

  return (
    <section className="invoice-workspace grid min-w-0 grid-cols-1 gap-6" aria-labelledby="invoice-panel-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stroke pb-6">
        <div className="min-w-0 max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2 w-2 rounded-full bg-clay" aria-hidden="true" />
            Invoices
          </p>
          <h1
            className="mt-1 font-sans text-3xl font-semibold leading-tight"
            id="invoice-panel-title"
          >
            Invoice activity
          </h1>
          <p className="mt-2 hidden text-ink-soft lg:block">
            Create invoices, follow confirmations, and open a row when you need
            the raw details.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link className={secondaryButton} href={archivedToggleHref}>
            {includeArchived ? "Hide archived" : "Show archived"}
          </Link>
          {csvExportHref ? (
            <a className={secondaryButton} href={csvExportHref}>
              Export CSV
            </a>
          ) : (
            <button
              className={secondaryButton}
              type="button"
              disabled
              title="Tour mode only"
            >
              Export CSV
            </button>
          )}
          <button className={`${primaryButton} order-first lg:order-none`} type="button" onClick={openCreate}>
            Create invoice
          </button>
        </div>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <form
            className="flex w-full flex-1 flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
          >
            <div className="grid min-w-0 flex-1 gap-2 sm:max-w-lg">
              <label className={labelClass} htmlFor="invoice_search">
                Search
              </label>
              <input
                className={inputClass}
                id="invoice_search"
                type="search"
                value={searchInput}
                placeholder="Invoice id, amount (XMR), subaddress, or metadata"
                onChange={(event) =>
                  setSearchDraft({
                    source: normalizedSearchQuery,
                    value: event.target.value,
                  })
                }
              />
            </div>
            <div className="flex gap-2">
              <button className={smallSecondaryButton} type="submit">
                Apply
              </button>
              {searchQuery ? (
                <Link
                  className={smallSecondaryButton}
                  href={buildInvoicesHref({ q: "" })}
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </div>
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
          <label className="grid min-w-0 gap-2 break-words text-xs font-semibold invoice-status-select">Status
            <select aria-label="Status" className={inputClass} value={statusFilter} onChange={event => router.push(buildInvoicesHref({ status: event.target.value as InvoicePanelProps["statusFilter"] }))}>
              {invoiceStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 break-words text-xs font-semibold">Sort by
            <select aria-label="Sort by" className={inputClass} value={sort} onChange={event => router.push(buildInvoicesHref({ sort: event.target.value }))}>
              <option value="created_at">Created</option><option value="amount_xmr">Amount</option><option value="status">Status</option><option value="confirmations">Confirmations</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-2 break-words text-xs font-semibold">Direction
            <select aria-label="Direction" className={inputClass} value={order} onChange={event => router.push(buildInvoicesHref({ order: event.target.value }))}>
              <option value="desc" aria-label="Descending">Desc.</option><option value="asc" aria-label="Ascending">Asc.</option>
            </select>
          </label>
        </div>
        <div
          className="invoice-status-filters flex-wrap gap-2"
          role="group"
          aria-label="Invoice status filters"
        >
          {invoiceStatusOptions.map((option) => (
            <Link
              key={option.value}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 ${
                statusFilter === option.value
                  ? "border-ink bg-ink text-cream shadow-[0_6px_14px_rgba(16,18,23,0.12)]"
                  : "border-stroke bg-white/60 text-ink hover:border-ink/40 hover:bg-white"
              }`}
              href={buildInvoicesHref({ status: option.value })}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {activeList.length === 0 ? (
          <div className="rounded-surface border border-stroke bg-white/70 p-5 text-sm text-ink-soft shadow-soft">
            <p className="font-semibold text-ink">
              No invoices match these filters.
            </p>
            <p className="mt-1">
              Adjust the search or status filter, or create a new invoice when
              you are ready to test the flow.
            </p>
          </div>
        ) : (
          <>
            <div className="invoice-cards grid min-w-0 grid-cols-1 gap-4">
              {activeList.map((invoice) => {
                const isExpanded = expandedInvoiceId === invoice.id;
                const context = invoiceContext(invoice.metadata);
                const showPaidAfterExpiry = Boolean(invoice.paid_after_expiry);
                const isArchivable =
                  !invoice.archived_at &&
                  (invoice.status === "pending" ||
                    invoice.status === "expired" ||
                    invoice.status === "invalid");
                return (
                  <div
                    key={invoice.id}
                    className={`min-w-0 rounded-xl border border-stroke bg-card p-4 shadow-soft transition-colors hover:border-ink/30 sm:p-5 ${
                      invoice.archived_at ? "bg-ink/5" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 grid gap-1 text-left">
                        {context.title ? <p className="break-words text-sm font-semibold">{context.title}</p> : null}
                        {mode === "tour" ? (
                          <span className="w-fit break-all font-mono text-xs font-semibold text-ink underline underline-offset-4">
                            {invoice.id}
                          </span>
                        ) : (
                          <Link
                            className="w-fit break-all font-mono text-xs font-semibold text-ink underline underline-offset-4"
                            href={`/invoice/${invoice.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {invoice.id}
                          </Link>
                        )}
                        <span className="truncate text-xs text-ink-soft">
                          {invoice.address.slice(0, 18)}…
                          {invoice.address.slice(-10)}
                        </span>
                      </div>
                      <div className="min-w-0 max-w-full text-right">
                        <p className={labelClass}>Amount</p>
                        <p className="mt-1 break-all font-mono text-lg font-semibold text-ink">
                          {formatXmrAmount(invoice.amount_xmr)} XMR
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {invoice.archived_at ? (
                        <StatusBadge label="Archived" />
                      ) : null}
                      {showPaidAfterExpiry ? (
                        <StatusBadge
                          label="Paid after expiry"
                          tone="detected"
                        />
                      ) : null}
                      <StatusBadge
                        label={formatStatus(invoice.status)}
                        tone={statusTone(invoice.status)}
                      />
                      <span className="ml-auto text-xs font-semibold text-ink-soft">
                        {invoice.confirmations ?? 0}/
                        {invoice.confirmation_target} confirmations
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-stroke pt-3 text-xs font-semibold text-ink-soft">
                      <p
                        suppressHydrationWarning
                        title={formatTimestamp(invoice.created_at)}
                      >
                        Created {formatTimestamp(invoice.created_at)}
                      </p>
                      <p
                        suppressHydrationWarning
                        title={formatTimestamp(invoice.expires_at)}
                      >
                        Expires {formatTimestamp(invoice.expires_at)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mode !== "tour" ? (
                        <Link
                          className={smallSecondaryButton}
                          href={`/invoice/${invoice.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </Link>
                      ) : null}
                      <button
                        className={smallSecondaryButton}
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleInvoice(invoice.id)}
                      >
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                      {isArchivable ? (
                        <button
                          className={smallSecondaryButton}
                          type="button"
                          onClick={() => openArchiveModal(invoice.id)}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                    {isExpanded ? (
                      <div className="mt-4 grid gap-4 rounded-xl border border-stroke bg-white/80 p-4 shadow-soft">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <p className={labelClass}>Invoice context</p>
                            <p className="break-all text-sm">{invoice.id}</p>
                            {context.details.map(detail => <p className="break-words text-sm" key={detail}>{detail}</p>)}
                            <p className={labelClass}>Created at</p>
                            <p
                              className="text-sm font-semibold text-ink"
                              title={
                                formatTimestamp(invoice.created_at)
                              }
                            >
                              {formatTimestamp(invoice.created_at)}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <p className={labelClass}>Detected at</p>
                            <p
                              className="text-sm font-semibold text-ink"
                              title={
                                formatTimestamp(invoice.detected_at)
                              }
                            >
                              {formatTimestamp(invoice.detected_at)}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <p className={labelClass}>Confirmed at</p>
                            <p
                              className="text-sm font-semibold text-ink"
                              title={
                                formatTimestamp(invoice.confirmed_at)
                              }
                            >
                              {formatTimestamp(invoice.confirmed_at)}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <p className={labelClass}>Expires at</p>
                            <p
                              className="text-sm font-semibold text-ink"
                              title={
                                formatTimestamp(invoice.expires_at)
                              }
                            >
                              {formatTimestamp(invoice.expires_at)}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <p className={labelClass}>Confirmation target</p>
                            <p className="text-sm font-semibold text-ink">
                              {invoice.confirmation_target}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <p className={labelClass}>Subaddress index</p>
                            <p className="text-sm font-semibold text-ink">
                              {invoice.subaddress_index ?? "-"}
                            </p>
                          </div>
                          {invoice.archived_at ? (
                            <div className="grid gap-2">
                              <p className={labelClass}>Archived at</p>
                              <p
                                className="text-sm font-semibold text-ink"
                                title={
                                  formatTimestamp(invoice.archived_at)
                                }
                              >
                                {formatTimestamp(invoice.archived_at)}
                              </p>
                            </div>
                          ) : null}
                          {invoice.paid_after_expiry_at ? (
                            <div className="grid gap-2">
                              <p className={labelClass}>Paid after expiry at</p>
                              <p
                                className="text-sm font-semibold text-ink"
                                title={
                                  formatTimestamp(invoice.paid_after_expiry_at)
                                }
                              >
                                {formatTimestamp(invoice.paid_after_expiry_at)}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isArchivable ? (
                            <button
                              className={smallSecondaryButton}
                              type="button"
                              onClick={() => openArchiveModal(invoice.id)}
                            >
                              Archive invoice
                            </button>
                          ) : !invoice.archived_at ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                              {formatStatus(invoice.status)} invoices cannot be
                              archived.
                            </p>
                          ) : null}
                          {archiveState.error &&
                          archiveModalInvoiceId === invoice.id ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink">
                              {archiveState.error}
                            </p>
                          ) : null}
                          {archiveState.archivedId === invoice.id ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink">
                              Invoice archived.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="invoice-table overflow-hidden rounded-surface border border-stroke bg-card shadow-soft">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[12.5rem]" />
                  <col className="w-[10rem]" />
                  <col className="w-[9.5rem]" />
                  <col className="w-[16.5rem]" />
                </colgroup>
                <thead className="bg-sand/40">
                  <tr className="border-b border-stroke">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      Invoice
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      <Link
                        className="underline underline-offset-4"
                        href={sortHref("amount_xmr")}
                      >
                        Amount{sortIndicator("amount_xmr")}
                      </Link>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      <Link
                        className="underline underline-offset-4"
                        href={sortHref("status")}
                      >
                        Status{sortIndicator("status")}
                      </Link>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      <Link
                        className="block underline underline-offset-4"
                        href={sortHref("confirmations")}
                      >
                        <span className="whitespace-nowrap">Confirmations</span>{" "}
                        <span className="inline-block">{sortIndicator("confirmations")}</span>
                      </Link>
                    </th>
                    <th className="border-l border-stroke px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.map((invoice) => {
                    const isExpanded = expandedInvoiceId === invoice.id;
                const context = invoiceContext(invoice.metadata);
                    const showPaidAfterExpiry = Boolean(
                      invoice.paid_after_expiry,
                    );
                    const isArchivable =
                      !invoice.archived_at &&
                      (invoice.status === "pending" ||
                        invoice.status === "expired" ||
                        invoice.status === "invalid");
                    return (
                      <Fragment key={invoice.id}>
                        <tr
                          className={`border-b border-stroke transition-colors hover:bg-white/70 ${invoice.archived_at ? "bg-ink/5" : ""}`}
                        >
                          <td className="min-w-0 px-4 py-3 align-top">
                            <div className="grid min-w-0 gap-1 text-left">
                              {context.title ? <p className="break-words text-sm font-semibold">{context.title}</p> : null}
                              {mode === "tour" ? (
                                <span
                                  className="block truncate font-mono text-xs text-ink underline underline-offset-4"
                                  title={invoice.id}
                                >
                                  {invoice.id}
                                </span>
                              ) : (
                                <Link
                                  className="block truncate font-mono text-xs text-ink underline underline-offset-4"
                                  href={`/invoice/${invoice.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={invoice.id}
                                >
                                  {invoice.id}
                                </Link>
                              )}
                              <span className="truncate text-xs text-ink-soft/80">
                                {invoice.address.slice(0, 18)}…
                                {invoice.address.slice(-10)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {invoice.archived_at ? (
                                <StatusBadge label="Archived" />
                              ) : null}
                              {showPaidAfterExpiry ? (
                                <StatusBadge
                                  label="Paid after expiry"
                                  tone="detected"
                                />
                              ) : null}
                            </div>
                          </td>
                          <td className="break-all px-4 py-3 align-top font-mono text-sm font-semibold text-ink">
                            <span>{formatXmrAmount(invoice.amount_xmr)}</span>{" "}<span className="inline-block">XMR</span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <StatusBadge
                              className="px-2 py-1 leading-tight"
                              label={formatStatus(invoice.status)}
                              tone={statusTone(invoice.status)}
                            />
                          </td>
                          <td className="px-4 py-3 align-top font-semibold text-ink whitespace-nowrap">
                            {invoice.confirmations ?? 0}/
                            {invoice.confirmation_target}
                          </td>
                          <td className="border-l border-stroke px-4 py-3 align-top">
                            <div className="flex min-w-0 flex-wrap gap-2">
                              {mode !== "tour" ? (
                                <Link
                                  className={smallSecondaryButton}
                                  href={`/invoice/${invoice.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </Link>
                              ) : null}
                              <button
                                className={smallSecondaryButton}
                                type="button"
                                aria-expanded={isExpanded}
                                onClick={() => toggleInvoice(invoice.id)}
                              >
                                {isExpanded ? "Hide" : "Details"}
                              </button>
                              {isArchivable ? (
                                <button
                                  className={smallSecondaryButton}
                                  type="button"
                                  onClick={() => openArchiveModal(invoice.id)}
                                >
                                  Archive
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="border-b border-stroke">
                            <td className="px-4 py-4" colSpan={5}>
                              <div className="grid gap-4 rounded-xl border border-stroke bg-white/80 p-4 shadow-soft">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="grid gap-2">
                                    <p className={labelClass}>Invoice context</p>
                            <p className="break-all text-sm">{invoice.id}</p>
                            {context.details.map(detail => <p className="break-words text-sm" key={detail}>{detail}</p>)}
                            <p className={labelClass}>Created at</p>
                                    <p
                                      className="text-sm font-semibold text-ink"
                                      title={
                                        formatTimestamp(invoice.created_at)
                                      }
                                    >
                                      {formatTimestamp(invoice.created_at)}
                                    </p>
                                  </div>
                                  <div className="grid gap-2">
                                    <p className={labelClass}>Detected at</p>
                                    <p
                                      className="text-sm font-semibold text-ink"
                                      title={
                                        formatTimestamp(invoice.detected_at)
                                      }
                                    >
                                      {formatTimestamp(invoice.detected_at)}
                                    </p>
                                  </div>
                                  <div className="grid gap-2">
                                    <p className={labelClass}>Confirmed at</p>
                                    <p
                                      className="text-sm font-semibold text-ink"
                                      title={
                                        formatTimestamp(invoice.confirmed_at)
                                      }
                                    >
                                      {formatTimestamp(invoice.confirmed_at)}
                                    </p>
                                  </div>
                                  <div className="grid gap-2">
                                    <p className={labelClass}>Expires at</p>
                                    <p
                                      className="text-sm font-semibold text-ink"
                                      title={
                                        formatTimestamp(invoice.expires_at)
                                      }
                                    >
                                      {formatTimestamp(invoice.expires_at)}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="grid gap-2">
                                    <p className={labelClass}>
                                      Confirmation target
                                    </p>
                                    <p className="text-sm font-semibold text-ink">
                                      {invoice.confirmation_target}
                                    </p>
                                  </div>
                                  <div className="grid gap-2">
                                    <p className={labelClass}>
                                      Subaddress index
                                    </p>
                                    <p className="text-sm font-semibold text-ink">
                                      {invoice.subaddress_index ?? "-"}
                                    </p>
                                  </div>
                                  {invoice.archived_at ? (
                                    <div className="grid gap-2">
                                      <p className={labelClass}>Archived at</p>
                                      <p
                                        className="text-sm font-semibold text-ink"
                                        title={
                                          formatTimestamp(invoice.archived_at)
                                        }
                                      >
                                        {formatTimestamp(invoice.archived_at)}
                                      </p>
                                    </div>
                                  ) : null}
                                  {invoice.paid_after_expiry_at ? (
                                    <div className="grid gap-2">
                                      <p className={labelClass}>
                                        Paid after expiry at
                                      </p>
                                      <p
                                        className="text-sm font-semibold text-ink"
                                        title={
                                          formatTimestamp(
                                            invoice.paid_after_expiry_at,
                                          )
                                        }
                                      >
                                        {formatTimestamp(
                                          invoice.paid_after_expiry_at,
                                        )}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  {isArchivable ? (
                                    <button
                                      className={secondaryButton}
                                      type="button"
                                      onClick={() =>
                                        openArchiveModal(invoice.id)
                                      }
                                    >
                                      Archive invoice
                                    </button>
                                  ) : !invoice.archived_at ? (
                                    <p className="text-sm text-ink-soft">
                                      {formatStatus(invoice.status)} invoices
                                      cannot be archived.
                                    </p>
                                  ) : null}
                                  {archiveState.error &&
                                  archiveModalInvoiceId === invoice.id ? (
                                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                                      {archiveState.error}
                                    </p>
                                  ) : null}
                                  {archiveState.success &&
                                  archiveState.archivedId === invoice.id ? (
                                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                                      {archiveState.success}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {mode !== "tour" ? (
              <nav
                className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4"
                aria-label="Invoice pages"
              >
                <p className="text-sm text-ink-soft">
                  Showing {resultStart}-{resultEnd} of {total} invoice
                  {total === 1 ? "" : "s"}
                </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Link
                        className={smallSecondaryButton}
                        href={buildInvoicesHref({ page: page - 1 })}
                      >
                        Previous
                      </Link>
                    ) : null}
                    <span className="px-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages ? (
                      <Link
                        className={smallSecondaryButton}
                        href={buildInvoicesHref({ page: page + 1 })}
                      >
                        Next
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
      {isCreateOpen ? (
        <>
          <CreateInvoiceModal
            key={createModalKey}
            mode={mode}
            defaultConfirmationTarget={defaultConfirmationTarget}
            onClose={closeCreate}
          />
        </>
      ) : null}

      {archiveModalInvoiceId ? (
        <AccessibleDialog
          ariaLabelledBy="archive-invoice-title"
          onClose={closeArchiveModal}
          panelClassName="max-h-[calc(100dvh-1.5rem)] max-w-lg p-5 sm:rounded-surface sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Archive invoice
              </p>
              <h2
                className="mt-1 font-sans text-xl font-semibold sm:text-2xl"
                id="archive-invoice-title"
              >
                Archive this invoice?
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Archived invoices stay available in the archive list.
              </p>
              {mode === "tour" ? (
                <p className="mt-2 text-sm font-semibold text-ink-soft">
                  Tour mode: no changes are saved.
                </p>
              ) : null}
            </div>
            <button
              className={secondaryButton}
              type="button"
              onClick={closeArchiveModal}
            >
              Close
            </button>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              className={secondaryButton}
              type="button"
              onClick={closeArchiveModal}
            >
              Cancel
            </button>
            <form action={archiveAction}>
              <input
                type="hidden"
                name="invoice_id"
                value={archiveModalInvoiceId}
              />
              <button className={primaryButton} type="submit">
                Archive invoice
              </button>
            </form>
          </div>
        </AccessibleDialog>
      ) : null}
    </section>
  );
}
