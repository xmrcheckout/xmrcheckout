"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { formatFiatAmount, formatXmrAmount } from "../lib/formatting";
import { useI18n } from "./i18n-provider";
import Link from "next/link";
import LanguageSwitcher from "./language-switcher";
import { demoRates } from "../lib/simulated-invoice";

type TerminalStatus = {
  name: string; default_currency: string; confirmation_target: number; expiry_minutes: number;
  currencies: string[]; available_addresses: number; low_addresses: boolean;
};
type Sale = {
  id: string; address: string; amount_xmr: string; amount_paid_xmr: string | null; amount_remaining_xmr: string | null;
  status: "pending" | "partially_paid" | "payment_detected" | "confirmed" | "expired" | "invalid";
  confirmation_target: number; confirmations: number; expires_at: string | null; note: string | null;
  quote?: { fiat_amount: string; fiat_currency: string } | null; invoice_url: string;
};

const STORAGE_KEY = "xmrcheckout_terminal_key";
const POLL_MS = 2000;
// Sample settings for the public demo till; nothing here reaches the API.
const DEMO_TERMINAL: TerminalStatus = {
  name: "", default_currency: "EUR", confirmation_target: 1, expiry_minutes: 15,
  currencies: ["XMR", ...Object.keys(demoRates)], available_addresses: 50, low_addresses: false,
};
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

function readStoredKey(): string | null {
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function storeKey(value: string | null) {
  try { if (value) window.localStorage.setItem(STORAGE_KEY, value); else window.localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
}
function initialKey(): string | null {
  const match = window.location.hash.match(/k=([A-Za-z0-9_-]+)/);
  if (match) storeKey(match[1]);
  return match?.[1] ?? readStoredKey();
}
function moneroUri(address: string, amount: string) {
  return `monero:${address}?${new URLSearchParams({ tx_amount: formatXmrAmount(amount) }).toString()}`;
}
function newAttemptKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID needs a secure context; plain-HTTP self-hosted installs fall back to getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function decimalsFor(currency: string) {
  return currency === "XMR" ? 12 : currency === "JPY" || currency === "KRW" ? 0 : 2;
}
function errorDetail(data: unknown, fallback: string) {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg.replace(/^Value error, /, "");
  return fallback;
}

export default function TerminalScreen({ demo = false }: { demo?: boolean }) {
  const { locale, t } = useI18n();
  // Rendered client-only, so the fragment and storage are available on first render.
  const [key, setKey] = useState<string | null>(() => demo ? null : initialKey());
  const [terminal, setTerminal] = useState<TerminalStatus | null>(() => demo ? { ...DEMO_TERMINAL, name: t("terminal.demoName") } : null);
  const [fatal, setFatal] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(demo ? DEMO_TERMINAL.default_currency : "XMR");
  const [note, setNote] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [qrImage, setQrImage] = useState<{ uri: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const attempt = useRef<string | null>(null);

  const call = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`/api/core/terminal${path}`, {
      ...init, cache: "no-store",
      headers: { Authorization: `Terminal ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) {
      setFatal(errorDetail(data, t("terminal.linkInvalid")));
      throw new Error("unauthorized");
    }
    return { response, data };
  }, [key, t]);

  // The secret arrives in the URL fragment; it is kept on this device and removed from the address bar.
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const { response, data } = await call("/status");
      if (response.ok) setTerminal(data);
      else setError(errorDetail(data, t("terminal.settingsUnavailable")));
    } catch (exc) {
      if ((exc as Error).message !== "unauthorized") setError(t("terminal.unreachable"));
    }
  }, [call, t]);

  useEffect(() => {
    if (!key) return;
    let active = true;
    fetch("/api/core/terminal/status", { cache: "no-store", headers: { Authorization: `Terminal ${key}` } })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (response.ok) { setTerminal(data); setCurrency(data.default_currency); }
        else if (response.status === 401 || response.status === 403) setFatal(errorDetail(data, t("terminal.linkInvalid")));
        else setError(errorDetail(data, t("terminal.settingsUnavailable")));
      })
      .catch(() => { if (active) setError(t("terminal.unreachable")); });
    return () => { active = false; };
  }, [key, t]);

  const dueUri = sale && !demo ? moneroUri(sale.address, sale.status === "partially_paid" && sale.amount_remaining_xmr ? sale.amount_remaining_xmr : sale.amount_xmr) : null;
  useEffect(() => {
    if (!dueUri) return;
    let active = true;
    QRCode.toDataURL(dueUri, { margin: 1, width: 640, errorCorrectionLevel: "M" })
      .then(url => { if (active) setQrImage({ uri: dueUri, url }); }).catch(() => undefined);
    return () => { active = false; };
  }, [dueUri]);
  const qr = qrImage && qrImage.uri === dueUri ? qrImage.url : null;

  const open = sale && ["pending", "partially_paid", "payment_detected"].includes(sale.status);
  useEffect(() => {
    if (!open || !sale) return;
    const timer = window.setInterval(async () => {
      setNow(Date.now());
      if (demo) return;
      try {
        const { response, data } = await call(`/invoices/${sale.id}`);
        if (response.ok) setSale(data);
      } catch { /* keep showing the last known state */ }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, sale, call, demo]);

  function press(value: string) {
    setError("");
    // A retry key belongs to one exact sale; any edit starts a new one.
    attempt.current = null;
    if (value === "⌫") return setAmount(current => current.slice(0, -1));
    setAmount(current => {
      const next = value === "." ? (current.includes(".") ? current : (current || "0") + ".") : current === "0" ? value : current + value;
      const [whole, fraction = ""] = next.split(".");
      if (whole.length > 7 || fraction.length > decimalsFor(currency) || (value === "." && decimalsFor(currency) === 0)) return current;
      return next;
    });
  }

  async function charge() {
    if (!amount || Number(amount) <= 0) return setError(t("terminal.enterAmount"));
    if (demo) {
      const value = amount.replace(/\.$/, "");
      const rate = demoRates[currency];
      setSale({
        id: "demo_sale", address: "", amount_xmr: rate ? (Number(value) / rate).toFixed(6) : value,
        amount_paid_xmr: null, amount_remaining_xmr: null, status: "pending",
        confirmation_target: DEMO_TERMINAL.confirmation_target, confirmations: 0,
        expires_at: new Date(Date.now() + DEMO_TERMINAL.expiry_minutes * 60000).toISOString(),
        note: note || null, quote: rate ? { fiat_amount: value, fiat_currency: currency } : null, invoice_url: "",
      });
      setNow(Date.now());
      return;
    }
    setBusy(true); setError("");
    attempt.current ??= newAttemptKey();
    try {
      const { response, data } = await call("/invoices", {
        method: "POST", headers: { "Idempotency-Key": attempt.current },
        body: JSON.stringify({ amount: amount.replace(/\.$/, ""), currency, note }),
      });
      attempt.current = null;
      if (response.ok) setSale(data);
      else setError(errorDetail(data, t("terminal.createFailed")));
    } catch (exc) {
      // Retrying with the same key returns the same invoice if the first request succeeded.
      if ((exc as Error).message !== "unauthorized") setError(t("terminal.connectionLostCharge"));
    } finally { setBusy(false); }
  }

  async function cancel() {
    if (!sale) return;
    if (demo) return newSale();
    setBusy(true);
    try {
      const { response, data } = await call(`/invoices/${sale.id}/cancel`, { method: "POST" });
      if (response.ok) newSale();
      else { setError(errorDetail(data, t("terminal.cancelFailed"))); const refreshed = await call(`/invoices/${sale.id}`); if (refreshed.response.ok) setSale(refreshed.data); }
    } catch { setError(t("terminal.connectionLost")); } finally { setBusy(false); }
  }

  function newSale() {
    setSale(null); setAmount(""); setNote(""); setError(""); attempt.current = null;
    if (!demo) void loadStatus();
  }

  function forget() {
    storeKey(null); setKey(null); setTerminal(null); setFatal("");
  }

  function simulate(status: Sale["status"]) {
    setSale(current => current && { ...current, status, confirmations: status === "confirmed" ? current.confirmation_target : 0 });
  }

  const shell = "flex min-h-dvh flex-col items-center justify-center bg-cream px-4 py-6 text-ink";
  const banner = demo ? <div className="mb-6 grid w-full max-w-md justify-items-center gap-2 rounded-xl border-l-2 border-clay bg-clay/5 px-4 py-3 text-center text-sm text-ink-soft">
    <p className="font-semibold text-ink" role="status">{t("demo.simulatedNoPayment")}</p>
    <Link className="min-h-11 py-2 font-semibold underline underline-offset-4" href="/tour?tab=terminals">{t("terminal.demoBack")}</Link>
  </div> : null;
  const simulateButton = (status: Sale["status"], label: string) => <button key={status} onClick={() => simulate(status)} className="min-h-11 rounded-full border border-clay px-4 text-sm font-semibold">{label}</button>;
  const demoControls = (steps: [Sale["status"], string][]) => demo ? <div className="mt-2 flex flex-wrap justify-center gap-2" aria-label={t("demo.previewState")}>{steps.map(([status, label]) => simulateButton(status, label))}</div> : null;
  if (!demo && (!key || fatal)) return <main className={shell}><div className="max-w-md text-center">
    <h1 className="font-sans text-3xl font-semibold">{t("terminal.unavailable")}</h1>
    <p className="mt-4" role="alert">{fatal || t("terminal.openFromDashboard")}</p>
    {fatal ? <button onClick={forget} className="mt-6 min-h-12 rounded-full border border-stroke px-6">{t("terminal.forget")}</button> : null}
  </div></main>;

  if (sale) {
    const remaining = sale.status === "partially_paid" && sale.amount_remaining_xmr;
    const due = remaining || sale.amount_xmr;
    const fiat = sale.quote ? formatFiatAmount(sale.quote.fiat_amount, sale.quote.fiat_currency, locale) : null;
    const seconds = sale.expires_at ? Math.max(0, Math.floor((Date.parse(sale.expires_at) - now) / 1000)) : null;
    if (sale.status === "confirmed" || sale.status === "payment_detected") {
      const waiting = sale.status === "payment_detected";
      return <main className={`${shell} ${waiting ? "" : "bg-emerald-50"}`} aria-live="polite">
        {banner}
        <div className="max-w-md text-center">
          <p className={`mx-auto grid size-28 place-items-center rounded-full text-6xl ${waiting ? "bg-amber-100 text-amber-800" : "bg-emerald-600 text-white"}`} aria-hidden="true">{waiting ? "…" : "✓"}</p>
          <h1 className="mt-6 font-sans text-4xl font-semibold">{waiting ? t("terminal.seen") : sale.confirmation_target === 0 ? t("terminal.seen") : t("invoicePage.timelineConfirmed")}</h1>
          <p className="mt-3 text-xl">{formatXmrAmount(sale.amount_xmr)} XMR{fiat ? ` · ${fiat}` : ""}</p>
          {waiting ? <p className="mt-3">{t("terminal.waiting", { confirmations: sale.confirmations, target: sale.confirmation_target })}</p> : null}
          {sale.confirmation_target === 0 && !waiting ? <p className="mt-3 text-sm text-ink-soft">{t("terminal.notInBlock")}</p> : null}
          {sale.note ? <p className="mt-2 text-ink-soft">{sale.note}</p> : null}
          {waiting ? <div className="mt-6">{demoControls([["confirmed", t("terminal.demoSimulateConfirmed")]])}</div> : null}
          <button onClick={newSale} className="mt-8 min-h-14 w-full rounded-full bg-ink px-8 text-lg text-cream">{t("terminal.newSale")}</button>
        </div>
      </main>;
    }
    if (sale.status === "expired" || sale.status === "invalid") {
      return <main className={shell}>{banner}<div className="max-w-md text-center">
        <h1 className="font-sans text-3xl font-semibold">{sale.status === "invalid" ? t("terminal.invalid") : t("terminal.expired")}</h1>
        {sale.amount_paid_xmr && Number(sale.amount_paid_xmr) > 0 ? <p className="mt-3">{t("terminal.receivedCheck", { amount: formatXmrAmount(sale.amount_paid_xmr) })}</p> : <p className="mt-3">{t("terminal.noPayment")}</p>}
        <button onClick={newSale} className="mt-8 min-h-14 w-full rounded-full bg-ink px-8 text-lg text-cream">{t("terminal.newSale")}</button>
      </div></main>;
    }
    return <main className={shell}>
      {banner}
      <div className="grid w-full max-w-md justify-items-center gap-4 text-center">
        <p className="text-sm uppercase tracking-wide text-ink-soft">{terminal?.name} · {t("pay.scan")}</p>
        <p className="font-sans text-4xl font-semibold break-all">{formatXmrAmount(due)} XMR</p>
        {remaining ? <p className="font-semibold text-amber-800">{t("terminal.partial")}</p> : fiat ? <p className="text-lg text-ink-soft">{t("pay.merchantPrice", { price: fiat })}</p> : null}
        {demo ? <div className="grid aspect-square w-full max-w-[360px] place-items-center rounded-2xl border-2 border-dashed border-stroke bg-white p-6 text-sm">{t("demo.qrPlaceholder")}</div> : qr ? <Image src={qr} alt={t("terminal.qrAlt", { amount: formatXmrAmount(due) })} width={320} height={320} unoptimized className="w-full max-w-[min(80vw,360px)] rounded-2xl bg-white p-3" /> : <div className="aspect-square w-full max-w-[360px] animate-pulse rounded-2xl bg-white" />}
        {sale.note ? <p className="text-ink-soft">{sale.note}</p> : null}
        <p className="text-sm text-ink-soft" aria-live="off">{seconds !== null ? t("terminal.expiresIn", { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }) : null}{!demo ? <>{seconds !== null ? " · " : ""}{t("terminal.watching")}</> : null}</p>
        {demoControls([["payment_detected", t("terminal.demoSimulateSeen")], ["confirmed", t("terminal.demoSimulateConfirmed")], ["expired", t("terminal.demoSimulateExpired")]])}
        {error ? <p role="alert" className="text-red-700">{error}</p> : null}
        <button onClick={cancel} disabled={busy || Boolean(remaining)} className="min-h-12 w-full rounded-full border border-stroke px-6 disabled:opacity-50">{t("terminal.cancel")}</button>
      </div>
    </main>;
  }

  const currencies = terminal?.currencies ?? ["XMR"];
  return <main className={shell}>
    {banner}
    <div className="grid w-full max-w-sm gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-sans text-lg font-semibold">{terminal?.name ?? t("terminal.title")}</h1>
        <select aria-label={t("paymentLink.currency")} value={currency} onChange={event => { setCurrency(event.target.value); setAmount(""); attempt.current = null; }} className="min-h-11 rounded-xl border border-stroke bg-white px-3">
          {currencies.map(code => <option key={code}>{code}</option>)}
        </select>
      </div>
      {terminal?.low_addresses ? <p role="status" className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">{t("terminal.lowAddresses", { count: terminal.available_addresses })}</p> : null}
      <output aria-live="polite" className="block rounded-2xl bg-white p-5 text-right font-sans text-5xl font-semibold break-all">{amount || "0"}<span className="ml-2 text-xl text-ink-soft">{currency}</span></output>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map(value => <button key={value} onClick={() => press(value)} aria-label={value === "⌫" ? t("terminal.delete") : value} className="min-h-16 rounded-2xl border border-stroke bg-white text-2xl font-semibold active:bg-stroke">{value}</button>)}
      </div>
      <label className="grid gap-1 text-sm">{t("terminal.note")}<input value={note} maxLength={200} onChange={event => { setNote(event.target.value); attempt.current = null; }} className="min-h-11 rounded-xl border border-stroke bg-white px-3 text-base" placeholder={t("terminal.notePlaceholder")} /></label>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
      <button onClick={charge} disabled={busy || !terminal} className="min-h-16 rounded-full bg-ink text-xl font-semibold text-cream disabled:opacity-60">{busy ? t("terminal.creating") : t("terminal.charge")}</button>
      {currency !== "XMR" ? <p className="text-center text-xs text-ink-soft">{t("terminal.conversionNote", { currency })}</p> : null}
      {demo ? null : <button onClick={() => { if (window.confirm(t("terminal.forgetConfirm"))) forget(); }} className="mx-auto min-h-11 px-4 text-sm text-ink-soft underline underline-offset-4">{t("terminal.forget")}</button>}
      <LanguageSwitcher className="mx-auto text-ink-soft" />
    </div>
  </main>;
}
