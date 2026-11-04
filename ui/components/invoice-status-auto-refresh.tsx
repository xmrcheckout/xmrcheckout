"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  useTransition, type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./i18n-provider";
import Timestamp from "./timestamp";
import type { InvoiceStatus } from "../lib/invoice-status";

const RefreshContext = createContext<{
  refresh: () => void;
  pending: boolean;
  retrievedAt: string | null;
  error: boolean;
  intervalMs: number;
  statusMessage: string;
  status?: string;
} | null>(null);

export const useInvoiceRefresh = () => useContext(RefreshContext);

type InvoiceStatusAutoRefreshProps = {
  children: ReactNode;
  intervalMs?: number;
  retrievedAt?: string;
  error?: boolean;
  statusMessage?: string;
  status?: InvoiceStatus;
};

export default function InvoiceStatusAutoRefresh({
  children,
  intervalMs = 30000,
  retrievedAt,
  error = false,
  statusMessage = "",
  status,
}: InvoiceStatusAutoRefreshProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const [lastRetrievedAt, setLastRetrievedAt] = useState(retrievedAt ?? null);
  if (retrievedAt && retrievedAt !== lastRetrievedAt) {
    setLastRetrievedAt(retrievedAt);
  }

  const refresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (!pending) inFlight.current = false;
  }, [pending]);

  useEffect(() => {
    if (status === "confirmed" || status === "invalid") return;
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, refresh, status]);

  return (
    <RefreshContext.Provider value={{ refresh, pending, retrievedAt: lastRetrievedAt, error, intervalMs, statusMessage, status }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function InvoiceRefreshFeedback({ className = "mx-auto mb-4 max-w-4xl text-sm text-ink-soft" }: { className?: string }) {
  const state = useInvoiceRefresh();
  const { t } = useI18n();
  if (!state) return null;
  return (
    <div className={className}>
      <p>{state.status === "confirmed" || state.status === "invalid"
        ? t("refresh.stopped")
        : state.status === "expired"
          ? t("refresh.expiredInterval", { seconds: state.intervalMs / 1000 })
          : t("refresh.interval", { seconds: state.intervalMs / 1000 })}</p>
      <p title={t("refresh.retrievedHint")}>
        {state.retrievedAt ? <>{t("refresh.retrieved")} <Timestamp value={state.retrievedAt} />.</> : t("refresh.notRetrieved")}
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" className={state.error ? "mt-2 text-red-700" : "sr-only"}>
        {state.error ? state.retrievedAt ? t("refresh.errorWithLast") : t("refresh.error") : state.statusMessage}
      </p>
      {state.error ? <button type="button" className="mt-2 min-h-11 rounded-full border border-stroke px-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink" onClick={state.refresh} disabled={state.pending} aria-busy={state.pending}>{state.pending ? t("refresh.refreshing") : t("refresh.retry")}</button> : null}
    </div>
  );
}
