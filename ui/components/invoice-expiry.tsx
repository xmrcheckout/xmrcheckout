"use client";

import { useEffect, useRef, useState } from "react";

import { timestampMs, timeRemaining } from "../lib/timestamps";
import { useInvoiceRefresh } from "./invoice-status-auto-refresh";
import Timestamp from "./timestamp";

export default function InvoiceExpiry({ expiresAt, retrievedAt }: {
  expiresAt: string | null;
  retrievedAt?: string;
}) {
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
      <p>{expiresAt ? <>Expires: <Timestamp value={expiresAt} /></> : "No expiry time is set."}</p>
      {expiresAt && expires === null ? <p>Expiry time unavailable. Refresh to check current invoice status.</p> : null}
      {/* A static deadline remains authoritative without JS. Ticks have no live
          region or animation, including with reduced motion enabled. */}
      <p aria-live="off">
        {past
          ? now === null
            ? "Expiry time has passed. Refresh to check current invoice status."
            : refreshState?.error
              ? "Expiry time has passed. Status unavailable. Retry to check current invoice status."
              : "Expiry time has passed. Status is being checked."
          : now !== null && expires !== null ? timeRemaining(expires, now) : null}
      </p>
      {expires !== null ? <noscript>Refresh the page to check current invoice status. The expiry time alone does not determine invoice status.</noscript> : null}
    </div>
  );
}
