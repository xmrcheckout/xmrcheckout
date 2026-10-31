"use client";

import { useState } from "react";
import { simulatedInvoice, simulationLabels, type SimulatedStatus, type SimulatedSnapshot } from "../lib/simulated-invoice";
import StatusBadge from "./status-badge";

type PreviewProps = { amount: string; target: number; description?: string; expiry?: string };

export function useSimulatedInvoice(target: number, initialStatus: SimulatedStatus = "pending", createdAt?: string, expiresAt?: string | null) {
  const [status, setStatus] = useState<SimulatedStatus>(initialStatus);
  return { snapshot: simulatedInvoice(status, target, createdAt, expiresAt), setStatus };
}

export default function SimulatedCheckoutPreview(props: PreviewProps) {
  const { snapshot, setStatus } = useSimulatedInvoice(props.target);
  return <SimulatedCheckoutDetails {...props} snapshot={snapshot} onStatusChange={setStatus} />;
}

export function SimulatedCheckoutDetails({ amount, target, description, expiry = "60 minutes", snapshot, onStatusChange }: PreviewProps & { snapshot: SimulatedSnapshot; onStatusChange: (status: SimulatedStatus) => void }) {
  const { status, confirmations } = snapshot;
  const labels = simulationLabels;
  return (
    <section className="grid min-w-0 gap-4 rounded-surface border border-stroke bg-card p-5" aria-label="Simulated checkout preview">
      <p className="font-semibold" role="status">Simulated—no payment requested</p>
      <label className="grid gap-2 text-sm font-semibold">Preview payment state
        <select className="min-h-11 w-full min-w-0 rounded-xl border border-stroke bg-white px-3" value={status} onChange={event => onStatusChange(event.target.value as SimulatedStatus)}>
          {Object.entries(labels).filter(([value]) => target !== 0 || value !== "payment_detected").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {target === 0 ? <p className="text-sm">With a zero-confirmation target, detection immediately reaches the target.</p> : null}
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
