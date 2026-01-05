"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import QRCode from "qrcode";

import {
  createInvoiceAction,
  type InvoiceState,
} from "../app/(app)/dashboard/actions";
import { formatUsdAmount, formatXmrAmount } from "../lib/formatting";
import { useXmrUsdRate } from "../lib/use-xmr-usd-rate";
import { useXmrFiatRate } from "../lib/use-xmr-fiat-rate";
import {
  FIAT_CURRENCY_SUGGESTIONS,
  getCurrencyFlag,
} from "../lib/fiat-currencies";

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

const buildMoneroUri = (state: InvoiceState): string | null => {
  if (!state.address || !state.amount) {
    return null;
  }
  const params = new URLSearchParams();
  params.set("tx_amount", state.amount);
  if (state.recipientName) {
    params.set("recipient_name", state.recipientName);
  }
  if (state.description) {
    params.set("tx_description", state.description);
  }
  return `monero:${state.address}?${params.toString()}`;
};

export default function CreateInvoiceCard() {
  const [state, formAction] = useFormState(createInvoiceAction, initialState);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrColor, setQrColor] = useState("#1b1b1a");
  const [qrLogo, setQrLogo] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [amountMode, setAmountMode] = useState<"xmr" | "fiat">("xmr");
  const [amountInput, setAmountInput] = useState("");
  const [fiatCurrency, setFiatCurrency] = useState("USD");
  const { rate: usdRate } = useXmrUsdRate();
  const { rate: fiatRate, status: fiatRateStatus } = useXmrFiatRate(
    amountMode === "fiat" ? fiatCurrency : null
  );
  const labelClass = "text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft";
  const inputClass =
    "w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10";
  const secondaryButton =
    "inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5";

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const publicInvoiceUrl = useMemo(() => {
    if (!state.invoiceId) {
      return null;
    }
    if (origin) {
      return new URL(`/invoice/${state.invoiceId}`, origin).toString();
    }
    return `/invoice/${state.invoiceId}`;
  }, [origin, state.invoiceId]);

  const uri = useMemo(() => buildMoneroUri(state), [state]);
  const amountValue = useMemo(() => {
    if (amountMode !== "xmr") {
      return null;
    }
    const raw = amountInput || state.amount || "";
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [amountInput, amountMode, state.amount]);
  const usdEstimate = useMemo(() => {
    if (!usdRate || amountValue === null || amountValue <= 0) {
      return null;
    }
    return formatUsdAmount(usdRate * amountValue);
  }, [usdRate, amountValue]);
  const fiatAmountValue = useMemo(() => {
    if (amountMode !== "fiat") {
      return null;
    }
    const parsed = Number.parseFloat(amountInput);
    return Number.isFinite(parsed) ? parsed : null;
  }, [amountInput, amountMode]);
  const xmrEstimate = useMemo(() => {
    if (!fiatRate || fiatAmountValue === null || fiatAmountValue <= 0) {
      return null;
    }
    const estimate = fiatAmountValue / fiatRate;
    return formatXmrAmount(estimate.toFixed(12));
  }, [fiatAmountValue, fiatRate]);
  const showFiatEstimate =
    amountMode === "fiat" && fiatAmountValue !== null && fiatAmountValue > 0;
  const fiatEstimateLabel = xmrEstimate
    ? `~${xmrEstimate} XMR`
    : fiatRateStatus === "loading"
      ? "Fetching estimate..."
      : "Estimate unavailable";
  const fiatCurrencyFlag = getCurrencyFlag(fiatCurrency);

  useEffect(() => {
    let active = true;
    if (!uri) {
      setQrDataUrl(null);
      return undefined;
    }

    QRCode.toDataURL(uri, {
      margin: 1,
      width: 220,
      errorCorrectionLevel: "H",
      color: {
        dark: qrColor,
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) {
          setQrDataUrl(url);
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
  }, [uri, qrColor]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setQrLogo(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setQrLogo(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl border border-stroke bg-white/80 p-6 shadow-card backdrop-blur">
      <h3 className="font-serif text-xl">Create test invoice</h3>
      <p className="mt-2 text-ink-soft">
        Generate an invoice address and draft invoice for validation.
      </p>
      <form className="mt-6 grid gap-4" action={formAction}>
        <div className="grid gap-2">
          <label className={labelClass} htmlFor="payment_address">
            Primary address
          </label>
          <input
            className={inputClass}
            id="payment_address"
            name="payment_address"
            type="text"
            placeholder="Enter your primary address"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className={labelClass} htmlFor="amount_mode">
            Amount type
          </label>
          <select
            className={inputClass}
            id="amount_mode"
            name="amount_mode"
            value={amountMode}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "xmr" || value === "fiat") {
                setAmountMode(value);
              }
            }}
          >
            <option value="xmr">XMR</option>
            <option value="fiat">Fiat</option>
          </select>
        </div>
        {amountMode === "xmr" ? (
          <div className="grid gap-2">
            <label className={labelClass} htmlFor="amount_xmr">
              Amount (XMR)
            </label>
            <input
              className={inputClass}
              id="amount_xmr"
              name="amount_xmr"
              type="number"
              step="0.000001"
              min="0"
              placeholder="0.10"
              required
              onChange={(event) => setAmountInput(event.target.value)}
            />
            {usdEstimate ? (
              <>
                <p className="text-sm text-ink-soft">
                  Approx. USD reference: ~{usdEstimate}
                </p>
                <details className="w-fit text-xs text-ink-soft">
                  <summary className="cursor-pointer select-none underline underline-offset-4">
                    About this estimate
                  </summary>
                  <p className="mt-2 max-w-[46ch] leading-relaxed">
                    Reference only, uses CoinGecko spot rate. Not a quote or guarantee.
                  </p>
                </details>
              </>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="grid gap-2">
              <label className={labelClass} htmlFor="amount_fiat">
                Amount (fiat)
              </label>
              <input
                className={inputClass}
                id="amount_fiat"
                name="amount_fiat"
                type="number"
                step="0.01"
                min="0"
                placeholder="100.00"
                required
                onChange={(event) => setAmountInput(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className={labelClass} htmlFor="currency">
                Currency
              </label>
              <input
                className={inputClass}
                id="currency"
                name="currency"
                type="text"
                placeholder="USD"
                list="fiat-currency-options"
                value={fiatCurrency}
                onChange={(event) => setFiatCurrency(event.target.value.toUpperCase())}
                required
              />
            </div>
            <datalist id="fiat-currency-options">
              {FIAT_CURRENCY_SUGGESTIONS.map((code) => (
                <option
                  key={code}
                  value={code}
                  label={`${getCurrencyFlag(code) ?? ""} ${code}`.trim()}
                />
              ))}
            </datalist>
            <p className="text-sm text-ink-soft sm:col-span-2">
              Fiat inputs create an XMR invoice using a non-binding rate at request time.
            </p>
            {showFiatEstimate ? (
              <div className="sm:col-span-2">
                <p className="text-sm text-ink-soft">
                  Approx. XMR value: {fiatEstimateLabel}
                  {fiatCurrencyFlag ? ` · ${fiatCurrencyFlag} ${fiatCurrency}` : ""}
                </p>
                {xmrEstimate ? (
                  <details className="w-fit text-xs text-ink-soft">
                    <summary className="cursor-pointer select-none underline underline-offset-4">
                      About this estimate
                    </summary>
                    <p className="mt-2 max-w-[46ch] leading-relaxed">
                      Reference only, uses CoinGecko spot rate. Not a quote or guarantee.
                    </p>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        <div className="grid gap-2">
          <label className={labelClass} htmlFor="confirmation_target">
            Confirmation target
          </label>
          <input
            className={inputClass}
            id="confirmation_target"
            name="confirmation_target"
            type="number"
            min="0"
            max="10"
            step="1"
            defaultValue={10}
            required
          />
          <p className="text-sm text-ink-soft">Expiry defaults to 24 hours.</p>
        </div>
        <div className="grid gap-2">
          <label className={labelClass} htmlFor="expires_date">
            Expiry date
          </label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <input
              className={inputClass}
              id="expires_date"
              name="expires_date"
              type="date"
            />
            <input
              className={inputClass}
              id="expires_time"
              name="expires_time"
              type="time"
            />
          </div>
          <p className="text-sm text-ink-soft">
            Leave blank to keep the default 24-hour expiry.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-stroke bg-white/60 px-4 py-3 text-sm font-semibold text-ink">
          <label className="flex items-center gap-3" htmlFor="instant_confirmation">
            <input
              className="h-4 w-4 rounded border-stroke text-ink focus:ring-ink/20"
              id="instant_confirmation"
              name="instant_confirmation"
              type="checkbox"
              value="1"
            />
            Instant confirmation (0 confirmations)
          </label>
        </div>
        <div className="grid gap-2">
          <label className={labelClass} htmlFor="recipient_name">
            Recipient name
          </label>
          <input
            className={inputClass}
            id="recipient_name"
            name="recipient_name"
            type="text"
            placeholder="Your store"
          />
        </div>
        <div className="grid gap-2">
          <label className={labelClass} htmlFor="description">
            Description
          </label>
          <input
            className={inputClass}
            id="description"
            name="description"
            type="text"
            placeholder="Order 1042"
          />
        </div>
        <div className="grid gap-2">
          <label className={labelClass} htmlFor="qr_color">
            QR accent color
          </label>
          <input
            className="h-12 w-full rounded-xl border border-stroke bg-white/80 px-3 py-2"
            id="qr_color"
            name="qr_color"
            type="color"
            value={qrColor}
            onChange={(event) => setQrColor(event.target.value)}
            aria-label="QR accent color"
          />
        </div>
        <div className="grid gap-2">
          <label className={labelClass} htmlFor="qr_logo">
            Logo overlay
          </label>
          <input
            className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink"
            id="qr_logo"
            name="qr_logo"
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
          />
          <p className="text-sm text-ink-soft">Logo overlays the QR center for branding.</p>
          {qrLogo ? (
            <button
              className={secondaryButton}
              type="button"
              onClick={() => setQrLogo(null)}
            >
              Remove logo
            </button>
          ) : null}
        </div>
        {state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}
        {state.invoiceId ? (
          <div className="grid gap-3 rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Invoice created
            </p>
            <code className="break-all rounded-lg bg-ink/10 px-3 py-2 text-sm text-ink">
              {state.invoiceId}
            </code>
            {publicInvoiceUrl ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Status link
                </p>
                <Link
                  className="break-all text-sm font-semibold text-ink underline"
                  href={publicInvoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {publicInvoiceUrl}
                </Link>
              </>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Address
            </p>
            <code className="break-all rounded-lg bg-ink/10 px-3 py-2 text-sm text-ink">
              {state.address}
            </code>
            {state.subaddressIndex !== null ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Subaddress index
                </p>
                <code className="rounded-lg bg-ink/10 px-3 py-2 text-sm text-ink">
                  {state.subaddressIndex}
                </code>
              </>
            ) : null}
            {state.warnings && state.warnings.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {state.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            {uri ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Payment request
                </p>
                <code className="break-all rounded-lg bg-ink/10 px-3 py-2 text-sm text-ink">
                  {uri}
                </code>
              </>
            ) : null}
            {qrDataUrl ? (
              <div className="relative mx-auto mt-2 h-[220px] w-[220px] rounded-2xl border border-stroke bg-white p-2">
                <Image
                  className="h-full w-full rounded-xl border border-ink/10 bg-white"
                  src={qrDataUrl}
                  alt="Payment request QR"
                  width={220}
                  height={220}
                  unoptimized
                />
                {qrLogo ? (
                  <Image
                    className="absolute left-1/2 top-1/2 h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white bg-white object-cover"
                    src={qrLogo}
                    alt="Logo overlay"
                    width={54}
                    height={54}
                    unoptimized
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end">
          <button className={secondaryButton} type="submit">
            Create invoice
          </button>
        </div>
      </form>
    </div>
  );
}
