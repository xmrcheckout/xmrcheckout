"use client";

import { useEffect, useState } from "react";

import { useI18n } from "./i18n-provider";

type Result = { invoice_url: string; status: string; expires_at: string | null };
const previousStatusKeys: Record<string, string> = {
  pending: "expired",
  partially_paid: "expired",
  expired: "expired",
  confirmed: "confirmed",
  invalid: "invalid",
  payment_detected: "payment_detected",
};

export default function AutomaticPaymentLink({ token, actionUrl }: { token: string; actionUrl: string }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState("fallback");
  const [message, setMessage] = useState("");
  const [previous, setPrevious] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let started = false;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function start() {
      if (started || document.visibilityState !== "visible" || (document as Document & { prerendering?: boolean }).prerendering) return;
      started = true;
      let attempt: string;
      try {
        const key = `payment-link-attempt:${token}`;
        const url = new URL(window.location.href);
        const stored = sessionStorage.getItem(key);
        attempt = url.searchParams.get("new") === "1" || !stored ? crypto.randomUUID() : stored;
        sessionStorage.setItem(key, attempt);
        if (url.searchParams.has("new")) {
          url.searchParams.delete("new");
          history.replaceState(null, "", url);
        }
      } catch {
        if (!disposed) setPhase("fallback");
        return;
      }
      setPhase("creating");
      setMessage(t("autoLink.creating"));
      try {
        const endpoint = new URL(actionUrl, window.location.href);
        if (endpoint.origin !== window.location.origin) throw new Error(t("autoLink.originMismatch"));
        const response = await fetch(endpoint, {
          method: "POST", cache: "no-store", credentials: "omit",
          headers: { Accept: "application/json", "Idempotency-Key": attempt },
          signal: AbortSignal.timeout(30000),
        });
        if (disposed) return;
        if (!response.ok) {
          const seconds = Number(response.headers.get("Retry-After"));
          if (Number.isFinite(seconds) && seconds > 0) {
            setWaiting(true);
            timer = setTimeout(() => setWaiting(false), Math.min(seconds * 1000, 2147483647));
          }
          const error = await response.json().catch(() => null);
          throw new Error(typeof error?.detail === "string" ? error.detail : t("autoLink.unavailable"));
        }
        const result: Result = await response.json();
        const destination = new URL(result.invoice_url);
        if (destination.origin !== window.location.origin || !/^\/invoice\/[0-9a-f-]+$/i.test(destination.pathname)) throw new Error(t("autoLink.invalidResponse"));
        const live = result.status === "payment_detected" || ((result.status === "pending" || result.status === "partially_paid") && (!result.expires_at || Date.parse(result.expires_at) > Date.now()));
        if (live) window.location.replace(destination.href);
        else { setPrevious(result); setPhase("previous"); }
      } catch (error) {
        if (disposed) return;
        setPhase("error");
        setMessage(t("autoLink.error", { reason: error instanceof Error ? error.message : t("autoLink.notConfirmed") }));
      }
    }
    void start();
    const activate = () => { void start(); };
    document.addEventListener("visibilitychange", activate);
    document.addEventListener("prerenderingchange", activate);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", activate);
      document.removeEventListener("prerenderingchange", activate);
    };
  }, [token, actionUrl, retry, t]);

  const buttonClass = "inline-flex min-h-11 items-center rounded-full border border-stroke px-5 py-3 font-semibold disabled:opacity-50";
  return <section aria-label={t("autoLink.label")} className="grid gap-4">
    {phase !== "fallback" ? <style>{".automatic-review { display: none; }"}</style> : <p>{t("autoLink.fallback")}</p>}
    {phase === "creating" || phase === "error" ? <p role="status">{message}</p> : null}
    {phase === "error" ? <button type="button" className={buttonClass} disabled={waiting} onClick={() => setRetry(value => value + 1)}>{waiting ? t("autoLink.wait") : t("autoLink.retry")}</button> : null}
    {phase === "previous" && previous ? <>
      <p>{t(`autoLink.previous.${previousStatusKeys[previous.status] ?? "expired"}`)} {t("autoLink.anotherOnlyIfIntended")}</p>
      <a className={buttonClass} href={previous.invoice_url}>{t("autoLink.viewPrevious")}</a>
      <a className={buttonClass} href={`/pay/${encodeURIComponent(token)}?new=1`}>{t("invoicePage.startAnother")}</a>
    </> : null}
  </section>;
}
