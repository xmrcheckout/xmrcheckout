"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "./relative-time";
import { formatUsdAmount, formatXmrAmount } from "../lib/formatting";
import { useXmrUsdRate } from "../lib/use-xmr-usd-rate";
import { useXmrFiatRate } from "../lib/use-xmr-fiat-rate";
import {
  FIAT_CURRENCY_SUGGESTIONS,
  getCurrencyFlag,
} from "../lib/fiat-currencies";

import {
  createInvoiceAction,
  archiveInvoiceAction,
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
  paid_after_expiry?: boolean;
  paid_after_expiry_at?: string | null;
  metadata?: Record<string, string> | null;
  created_at: string;
  archived_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
  expires_at: string | null;
};

type InvoicePanelProps = {
  activeInvoices: InvoiceItem[];
  includeArchived: boolean;
  searchQuery: string;
  sort: string;
  order: string;
  defaultConfirmationTarget: number;
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
  return new Date(value).toLocaleString();
};

type CreateInvoiceModalProps = {
  defaultConfirmationTarget: number;
  onClose: () => void;
};

function CreateInvoiceModal({ defaultConfirmationTarget, onClose }: CreateInvoiceModalProps) {
  const router = useRouter();
  const [state, formAction] = useFormState(createInvoiceAction, initialState);
  const [amount, setAmount] = useState("");
  const [amountMode, setAmountMode] = useState<"xmr" | "fiat">("xmr");
  const [fiatCurrency, setFiatCurrency] = useState("USD");
  const [confirmationMode, setConfirmationMode] = useState<"account_default" | "custom">(
    "account_default"
  );
  const [confirmationTarget, setConfirmationTarget] = useState(
    String(defaultConfirmationTarget ?? 10)
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
  const [createInvoiceOrigin, setCreateInvoiceOrigin] = useState<string | null>(
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? null
  );
  const { rate: usdRate } = useXmrUsdRate();
  const { rate: fiatRate, status: fiatRateStatus } = useXmrFiatRate(
    amountMode === "fiat" ? fiatCurrency : null
  );

  useEffect(() => {
    if (createInvoiceOrigin) {
      return;
    }
    setCreateInvoiceOrigin(window.location.origin);
  }, [createInvoiceOrigin]);

  useEffect(() => {
    if (!state.invoiceId) {
      return;
    }
    router.refresh();
  }, [router, state.invoiceId]);

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
    const estimate = fiatAmountValue / fiatRate;
    return formatXmrAmount(estimate.toFixed(12));
  }, [fiatAmountValue, fiatRate]);

  const showFiatEstimate =
    amountMode === "fiat" && fiatAmountValue !== null && fiatAmountValue > 0;
  const draftXmrEstimateLabel = draftXmrEstimate
    ? `~${draftXmrEstimate} XMR`
    : fiatRateStatus === "loading"
      ? "Fetching estimate..."
      : "Estimate unavailable";
  const fiatCurrencyFlag = getCurrencyFlag(fiatCurrency);
  const fiatCurrencyLabel = fiatCurrencyFlag
    ? `${fiatCurrencyFlag} ${fiatCurrency}`
    : fiatCurrency;

  const expiryTimeValue = expiresTime || "00:00";
  const expiryValue = expiresDate ? `${expiresDate}T${expiryTimeValue}` : "";
  const expiryIsValid =
    expiryMode !== "custom" || (!expiresTime && !expiresDate) || !!expiresDate;
  const isFiatCurrencyValid = amountMode !== "fiat" || Boolean(fiatCurrency.trim());

  const handleQrLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const labelClass = "text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft";
  const inputClass =
    "w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10";
  const primaryButton =
    "inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70";
  const secondaryButton =
    "inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70";
  const smallSecondaryButton =
    "inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70";

  const createDisabled =
    !amount ||
    !isFiatCurrencyValid ||
    (confirmationMode === "custom" && !confirmationTarget) ||
    !expiryIsValid ||
    (qrLogoMode === "custom" && !qrLogoDataUrl);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4 py-10">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-stroke bg-white shadow-deep">
        <div className="flex flex-wrap items-start justify-between gap-4 p-8 pb-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Create invoice
            </p>
            <h2 className="mt-2 font-serif text-2xl">Create a new invoice</h2>
          </div>
          <button className={secondaryButton} type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col gap-6 px-8 pb-8 pt-6"
          action={formAction}
        >
          {state.invoiceId ? (
            <div className="grid gap-4">
              {publicInvoiceUrl ? (
                <div className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                    Invoice created
                  </p>
                  <p className="mt-3 text-sm text-ink">
                    Share this invoice link with your customer:
                  </p>
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
                  {state.warnings && state.warnings.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {state.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {state.error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {state.error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button className={secondaryButton} type="button" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid gap-6">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label className={labelClass} htmlFor="wizard_amount_mode">
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
                        <label className={labelClass} htmlFor="wizard_amount_xmr">
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
                              Reference only, uses CoinGecko spot rate. Not a quote or guarantee.
                            </p>
                          </details>
                        ) : null}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                        <div className="grid gap-2">
                          <label className={labelClass} htmlFor="wizard_amount_fiat">
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
                          <label className={labelClass} htmlFor="wizard_currency">
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
                          {FIAT_CURRENCY_SUGGESTIONS.map((code) => (
                            <option
                              key={code}
                              value={code}
                              label={`${getCurrencyFlag(code) ?? ""} ${code}`.trim()}
                            />
                          ))}
                        </datalist>
                        <p className="text-sm text-ink-soft sm:col-span-2">
                          Fiat inputs create an XMR invoice using a non-binding rate at request
                          time.
                        </p>
                        {showFiatEstimate ? (
                          <details className="w-fit text-xs text-ink-soft sm:col-span-2">
                            <summary className="cursor-pointer select-none underline underline-offset-4">
                              Approx. XMR value: {draftXmrEstimateLabel}
                              {fiatCurrencyFlag ? ` · ${fiatCurrencyLabel}` : ""}
                            </summary>
                            <p className="mt-2 max-w-[46ch] leading-relaxed">
                              Reference only, uses CoinGecko spot rate. Not a quote or guarantee.
                            </p>
                          </details>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <details className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                    <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
                      Optional details
                    </summary>
                    <div className="mt-4 grid gap-5">
                      <div className="grid gap-3">
                        <p className={labelClass}>Confirmations</p>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
                          <div className="grid gap-2">
                            <label className={labelClass} htmlFor="wizard_confirmation_mode">
                              Mode
                            </label>
                            <select
                              className={inputClass}
                              id="wizard_confirmation_mode"
                              value={confirmationMode}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value === "account_default" || value === "custom") {
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
                              <label className={labelClass} htmlFor="wizard_confirmation_target">
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
                                onChange={(event) => setConfirmationTarget(event.target.value)}
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
                              Create the invoice with a custom confirmation target.
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-3">
                        <p className={labelClass}>Expiry</p>
                        <div className="grid gap-2">
                          <label className={labelClass} htmlFor="wizard_expiry_mode">
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
                            <option value="default">Default (60 minutes)</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>

                        {expiryMode === "custom" ? (
                          <div className="grid gap-2">
                            <label className={labelClass} htmlFor="wizard_expires_date">
                              Expiry date
                            </label>
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                              <input
                                className={inputClass}
                                id="wizard_expires_date"
                                name="expires_date"
                                type="date"
                                value={expiresDate}
                                onChange={(event) => setExpiresDate(event.target.value)}
                              />
                              <input
                                className={inputClass}
                                id="wizard_expires_time"
                                name="expires_time"
                                type="time"
                                value={expiresTime}
                                onChange={(event) => setExpiresTime(event.target.value)}
                              />
                            </div>
                            <input type="hidden" name="expires_at" value={expiryValue} />
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <label className={labelClass} htmlFor="wizard_recipient">
                            Recipient name
                          </label>
                          <input
                            className={inputClass}
                            id="wizard_recipient"
                            name="recipient_name"
                            type="text"
                            placeholder="Your store"
                            value={recipientName}
                            onChange={(event) => setRecipientName(event.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <label className={labelClass} htmlFor="wizard_description">
                            Description
                          </label>
                          <input
                            className={inputClass}
                            id="wizard_description"
                            name="description"
                            type="text"
                            placeholder="Order 1042"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label className={labelClass} htmlFor="wizard_checkout_continue_url">
                          Continue URL
                        </label>
                        <input
                          className={inputClass}
                          id="wizard_checkout_continue_url"
                          name="checkout_continue_url"
                          type="url"
                          placeholder="https://merchant.example/thanks"
                          value={checkoutContinueUrl}
                          onChange={(event) => setCheckoutContinueUrl(event.target.value)}
                        />
                        <p className="text-sm text-ink-soft">
                          After confirmation, the hosted invoice page can show a Continue button.
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <label className={labelClass} htmlFor="wizard_qr_logo_mode">
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
                          <option value="account_default">Account default</option>
                          <option value="monero">Monero logo</option>
                          <option value="none">No logo</option>
                          <option value="custom">Custom image</option>
                        </select>
                        <input
                          type="hidden"
                          name="qr_logo_data_url"
                          value={qrLogoMode === "custom" ? qrLogoDataUrl ?? "" : ""}
                        />
                        {qrLogoMode === "custom" ? (
                          <input
                            className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink"
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
                  </div>

                  {state.error ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                      {state.error}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-stroke pt-4">
                <button className={secondaryButton} type="button" onClick={onClose}>
                  Cancel
                </button>
                <button className={primaryButton} type="submit" disabled={createDisabled}>
                  Create invoice
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export default function InvoicePanel({
  activeInvoices,
  includeArchived,
  searchQuery,
  sort,
  order,
  defaultConfirmationTarget,
}: InvoicePanelProps) {
  const router = useRouter();
  const [archiveState, archiveAction] = useFormState(
    archiveInvoiceAction,
    initialArchiveState
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createModalKey, setCreateModalKey] = useState(0);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [archiveModalInvoiceId, setArchiveModalInvoiceId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchQuery ?? "");

  const activeList = activeInvoices;
  const archivedToggleHref = includeArchived
    ? "/dashboard?tab=invoices"
    : "/dashboard?tab=invoices&archived=1";

  useEffect(() => {
    setSearchInput(searchQuery ?? "");
  }, [searchQuery]);

  const buildInvoicesHref = (next: {
    q?: string;
    sort?: string;
    order?: string;
    includeArchived?: boolean;
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
    const nextSort = next.sort ?? sort;
    if (nextSort) {
      params.set("sort", nextSort);
    }
    const nextOrder = next.order ?? order;
    if (nextOrder) {
      params.set("order", nextOrder);
    }
    return `/dashboard?${params.toString()}`;
  };

  const csvExportHref = (() => {
    const params = new URLSearchParams();
    if (includeArchived) {
      params.set("include_archived", "true");
    }
    const trimmed = (searchQuery ?? "").trim();
    if (trimmed) {
      params.set("q", trimmed);
    }
    if (sort) {
      params.set("sort", sort);
    }
    if (order) {
      params.set("order", order);
    }
    const suffix = params.toString();
    return suffix ? `/dashboard/invoices.csv?${suffix}` : "/dashboard/invoices.csv";
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
    if (archiveState.archivedId && expandedInvoiceId === archiveState.archivedId) {
      setExpandedInvoiceId(null);
      setArchiveModalInvoiceId(null);
      router.refresh();
    }
  }, [archiveState.archivedId, expandedInvoiceId, router]);

  const labelClass = "text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft";
  const inputClass =
    "w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10";
  const primaryButton =
    "inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70";
  const secondaryButton =
    "inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70";
  const smallSecondaryButton =
    "inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70";

  const sortHref = (key: string) => {
    const nextOrder = sort === key && order === "asc" ? "desc" : "asc";
    return buildInvoicesHref({ sort: key, order: nextOrder });
  };

  const applySearch = () => {
    router.push(buildInvoicesHref({ q: searchInput }));
  };

  return (
    <div className="rounded-2xl border border-stroke bg-white/80 p-8 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Invoices</h1>
          <p className="mt-2 text-ink-soft">
            Search, sort, and expand invoices for details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className={secondaryButton} href={archivedToggleHref}>
            {includeArchived ? "Hide archived" : "Show archived"}
          </Link>
          <a className={secondaryButton} href={csvExportHref}>
            Export CSV
          </a>
          <button className={primaryButton} type="button" onClick={openCreate}>
            Create invoice
          </button>
        </div>
      </div>
      <div className="mt-6 grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <form
            className="flex w-full flex-1 flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
          >
            <div className="grid w-full gap-2 sm:max-w-lg">
              <label className={labelClass} htmlFor="invoice_search">
                Search
              </label>
              <input
                className={inputClass}
                id="invoice_search"
                type="search"
                value={searchInput}
                placeholder="Invoice id, amount (XMR), subaddress, or metadata"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className={smallSecondaryButton} type="submit">
                Apply
              </button>
              {searchQuery ? (
                <Link className={smallSecondaryButton} href={buildInvoicesHref({ q: "" })}>
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </div>

        {activeList.length === 0 ? (
          <p className="text-sm font-semibold text-ink-soft">
            No invoices match your filters.
          </p>
        ) : (
          <>
            <div className="grid gap-4 lg:hidden">
              {activeList.map((invoice) => {
                const isExpanded = expandedInvoiceId === invoice.id;
                const showPaidAfterExpiry = Boolean(invoice.paid_after_expiry);
                const isArchivable =
                  !invoice.archived_at &&
                  (invoice.status === "pending" ||
                    invoice.status === "expired" ||
                    invoice.status === "invalid");
                return (
                  <div
                    key={invoice.id}
                    className={`rounded-2xl border border-stroke bg-white/70 p-4 shadow-soft ${
                      invoice.archived_at ? "bg-ink/5" : ""
                    }`}
                  >
                    <div
                      className="grid cursor-pointer gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white/60"
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleInvoice(invoice.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleInvoice(invoice.id);
                        }
                      }}
                    >
                      <Link
                        className="w-fit font-mono text-xs text-ink underline underline-offset-4"
                        href={`/invoice/${invoice.id}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {invoice.id}
                      </Link>
                      <span className="text-xs text-ink-soft">
                        {invoice.address.slice(0, 18)}…{invoice.address.slice(-10)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {invoice.archived_at ? (
                        <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink">
                          Archived
                        </span>
                      ) : null}
                      {showPaidAfterExpiry ? (
                        <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink">
                          Paid after expiry
                        </span>
                      ) : null}
                      <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink">
                        {formatStatus(invoice.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1">
                        <p className={labelClass}>Amount</p>
                        <p className="text-sm font-semibold text-ink">
                          {formatXmrAmount(invoice.amount_xmr)} XMR
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className={smallSecondaryButton}
                        type="button"
                        onClick={() => toggleInvoice(invoice.id)}
                      >
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                    </div>
                    {isExpanded ? (
                      <div className="mt-4 grid gap-4 rounded-xl border border-stroke bg-white/80 p-4 shadow-soft">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <p className={labelClass}>Created at</p>
                            <p
                              className="text-sm font-semibold text-ink"
                              title={formatRelativeTime(invoice.created_at) ?? undefined}
                            >
                              {formatTimestamp(invoice.created_at)}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <p className={labelClass}>Detected at</p>
                            <p
                              className="text-sm font-semibold text-ink"
                              title={formatRelativeTime(invoice.detected_at) ?? undefined}
                            >
                              {formatTimestamp(invoice.detected_at)}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <p className={labelClass}>Confirmed at</p>
                            <p
                              className="text-sm font-semibold text-ink"
                              title={formatRelativeTime(invoice.confirmed_at) ?? undefined}
                            >
                              {formatTimestamp(invoice.confirmed_at)}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <p className={labelClass}>Expires at</p>
                            <p
                              className="text-sm font-semibold text-ink"
                              title={formatRelativeTime(invoice.expires_at) ?? undefined}
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
                                title={formatRelativeTime(invoice.archived_at) ?? undefined}
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
                                  formatRelativeTime(invoice.paid_after_expiry_at) ?? undefined
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
                          ) : (
                            !invoice.archived_at ? (
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                                {formatStatus(invoice.status)} invoices cannot be archived.
                              </p>
                            ) : null
                          )}
                          {archiveState.error && archiveModalInvoiceId === invoice.id ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">
                              {archiveState.error}
                            </p>
                          ) : null}
                          {archiveState.archivedId === invoice.id ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage">
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
            <div className="hidden overflow-x-auto rounded-2xl border border-stroke bg-white/70 shadow-soft lg:block">
              <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-white/60">
                <tr className="border-b border-stroke">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                    Invoice
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                    <Link className="underline underline-offset-4" href={sortHref("amount_xmr")}>
                      Amount
                    </Link>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                    <Link className="underline underline-offset-4" href={sortHref("status")}>
                      Status
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeList.map((invoice) => {
                  const isExpanded = expandedInvoiceId === invoice.id;
                  const showPaidAfterExpiry = Boolean(invoice.paid_after_expiry);
                  const isArchivable =
                    !invoice.archived_at &&
                    (invoice.status === "pending" ||
                      invoice.status === "expired" ||
                      invoice.status === "invalid");
                  return (
                    <Fragment key={invoice.id}>
                      <tr
                        className={`border-b border-stroke ${invoice.archived_at ? "bg-ink/5" : ""}`}
                      >
                        <td className="max-w-[320px] px-4 py-3 align-top">
                          <div
                            className="grid cursor-pointer gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white/60"
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleInvoice(invoice.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleInvoice(invoice.id);
                              }
                            }}
                          >
                            <Link
                              className="w-fit break-words font-mono text-xs text-ink underline underline-offset-4"
                              href={`/invoice/${invoice.id}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {invoice.id}
                            </Link>
                            <span className="break-words text-xs text-ink-soft">
                              {invoice.address.slice(0, 18)}…{invoice.address.slice(-10)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {invoice.archived_at ? (
                              <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink">
                                Archived
                              </span>
                            ) : null}
                            {showPaidAfterExpiry ? (
                              <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink">
                                Paid after expiry
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top font-semibold text-ink whitespace-nowrap">
                          {formatXmrAmount(invoice.amount_xmr)} XMR
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink whitespace-nowrap">
                            {formatStatus(invoice.status)}
                          </span>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-b border-stroke">
                          <td className="px-4 py-4" colSpan={3}>
                            <div className="grid gap-4 rounded-xl border border-stroke bg-white/80 p-4 shadow-soft">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-2">
                                  <p className={labelClass}>Created at</p>
                                  <p
                                    className="text-sm font-semibold text-ink"
                                    title={formatRelativeTime(invoice.created_at) ?? undefined}
                                  >
                                    {formatTimestamp(invoice.created_at)}
                                  </p>
                                </div>
                                <div className="grid gap-2">
                                  <p className={labelClass}>Detected at</p>
                                  <p
                                    className="text-sm font-semibold text-ink"
                                    title={formatRelativeTime(invoice.detected_at) ?? undefined}
                                  >
                                    {formatTimestamp(invoice.detected_at)}
                                  </p>
                                </div>
                                <div className="grid gap-2">
                                  <p className={labelClass}>Confirmed at</p>
                                  <p
                                    className="text-sm font-semibold text-ink"
                                    title={formatRelativeTime(invoice.confirmed_at) ?? undefined}
                                  >
                                    {formatTimestamp(invoice.confirmed_at)}
                                  </p>
                                </div>
                                <div className="grid gap-2">
                                  <p className={labelClass}>Expires at</p>
                                  <p
                                    className="text-sm font-semibold text-ink"
                                    title={formatRelativeTime(invoice.expires_at) ?? undefined}
                                  >
                                    {formatTimestamp(invoice.expires_at)}
                                  </p>
                                </div>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
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
                                      title={formatRelativeTime(invoice.archived_at) ?? undefined}
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
                                        formatRelativeTime(invoice.paid_after_expiry_at) ??
                                        undefined
                                      }
                                    >
                                      {formatTimestamp(invoice.paid_after_expiry_at)}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                {isArchivable ? (
                                  <button
                                    className={secondaryButton}
                                    type="button"
                                    onClick={() => openArchiveModal(invoice.id)}
                                  >
                                    Archive invoice
                                  </button>
                                ) : (
                                  !invoice.archived_at ? (
                                    <p className="text-sm text-ink-soft">
                                      {formatStatus(invoice.status)} invoices cannot be archived.
                                    </p>
                                  ) : null
                                )}
                                {archiveState.error && archiveModalInvoiceId === invoice.id ? (
                                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
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
          </>
        )}
      </div>
      <div className="mt-6 rounded-2xl border border-ink/10 bg-ink/10 px-4 py-3 text-sm font-semibold text-ink">
        We never hold funds. All payments move from the customer to your wallet.
      </div>

      {isCreateOpen ? (
        <>
          <CreateInvoiceModal
            key={createModalKey}
            defaultConfirmationTarget={defaultConfirmationTarget}
            onClose={closeCreate}
          />
          
        </>
      ) : null}

      {archiveModalInvoiceId ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4 py-10">
          <div className="w-full max-w-lg rounded-3xl border border-stroke bg-white p-8 shadow-deep">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Archive invoice
                </p>
                <h2 className="mt-2 font-serif text-2xl">Archive this invoice?</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Archived invoices stay available in the archive list.
                </p>
              </div>
              <button className={secondaryButton} type="button" onClick={closeArchiveModal}>
                Close
              </button>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button className={secondaryButton} type="button" onClick={closeArchiveModal}>
                Cancel
              </button>
              <form action={archiveAction}>
                <input type="hidden" name="invoice_id" value={archiveModalInvoiceId} />
                <button className={primaryButton} type="submit">
                  Archive invoice
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
