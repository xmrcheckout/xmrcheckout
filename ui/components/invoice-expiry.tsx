"use client";

import { useEffect, useRef, useState } from "react";

import { timestampMs, timeRemaining } from "../lib/timestamps";
import { useInvoiceRefresh } from "./invoice-status-auto-refresh";
import { useI18n } from "./i18n-provider";
import Timestamp from "./timestamp";

export default function InvoiceExpiry({ expiresAt, retrievedAt }: {
  expiresAt: string | null;
  retrievedAt?: string;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState<number | null>(null);
  const checkedExpiry = useRef<string | null>(null);
  const refreshState = useInvoiceRefresh();
  const refresh = refreshState?.refresh;
  const expires = timestampMs(expiresAt);
  const retrieved = timestampMs(retrievedAt);
  const past = expires !== null && (now ?? retrieved ?? 0) >= expires;

  useEffect(() => {
    if (expires === null) return;
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [expires]);

  useEffect(() => {
    if (now === null || !past || !refresh || checkedExpiry.current === expiresAt) return;
    checkedExpiry.current = expiresAt;
    refresh();
  }, [expiresAt, now, past, refresh]);

  return (
    <div className="mt-3 break-words text-sm" data-invoice-expiry>
      <p>{expiresAt ? <>{t("expiry.expires")} <Timestamp value={expiresAt} /></> : t("expiry.none")}</p>
      {expiresAt && expires === null ? <p>{t("expiry.unavailable")}</p> : null}
      {/* A static deadline remains authoritative without JS. Ticks have no live
          region or animation, including with reduced motion enabled. */}
      <p aria-live="off">
        {past
          ? now === null
            ? t("expiry.passedRefresh")
            : refreshState?.error
              ? t("expiry.passedUnavailable")
              : t("expiry.passedChecking")
          : now !== null && expires !== null ? timeRemaining(expires, now, t) : null}
      </p>
      {expires !== null ? <noscript>{t("expiry.noscript")}</noscript> : null}
    </div>
  );
}
