"use client";

import { useState } from "react";
import StatusBadge from "./status-badge";

export default function SimulatedCheckoutPreview({ amount, target, description, expiry = "60 minutes" }: { amount: string; target: number; description?: string; expiry?: string }) {
  const [status, setStatus] = useState("pending");
  const labels: Record<string, string> = { pending: "Awaiting payment", payment_detected: "Payment detected", confirmed: "Confirmed", expired: "Expired", invalid: "Invalid" };
  const confirmations = status === "confirmed" ? target : status === "payment_detected" ? Math.max(0, target - 1) : 0;
  return (
    <section className="grid min-w-0 gap-4 rounded-surface border border-stroke bg-card p-5" aria-label="Simulated checkout preview">
      <p className="font-semibold" role="status">Simulated—no payment requested</p>
      <label className="grid gap-2 text-sm font-semibold">Preview payment state
        <select className="min-h-11 w-full min-w-0 rounded-xl border border-stroke bg-white px-3" value={status} onChange={event => setStatus(event.target.value)}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <div aria-live="polite" aria-atomic="true" className="grid gap-3">
        <StatusBadge label={labels[status]} tone={status === "confirmed" ? "success" : status === "payment_detected" ? "detected" : status === "pending" ? "pending" : "error"} />
        <p className="break-words font-mono text-2xl font-semibold">{amount} XMR</p>
        {description ? <p className="break-words">{description}</p> : null}
        <p>Example confirmations: {confirmations}/{target}</p>
        <p>{status === "expired" || status === "invalid" ? "Do not send payment. In a real checkout, contact the merchant for a new invoice." : status === "pending" ? "A real checkout would show payment instructions here." : "No further payment is requested."}</p>
      </div>
      <div className="grid min-h-32 place-items-center rounded-xl border-2 border-dashed border-stroke p-4 text-center text-sm">QR preview placeholder — not scannable</div>
      <p className="text-sm">Example only — no payment address</p>
      <p className="break-words text-sm">Example expiry: {expiry}. State changes are manual; no network checks occur.</p>
    </section>
  );
}
