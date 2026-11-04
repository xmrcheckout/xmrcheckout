"use client";

import { useState } from "react";
import { simulatedInvoice, simulatedStatuses, type SimulatedStatus, type SimulatedSnapshot } from "../lib/simulated-invoice";
import { useI18n } from "./i18n-provider";
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

export function SimulatedCheckoutDetails({ amount, target, description, expiry, snapshot, onStatusChange }: PreviewProps & { snapshot: SimulatedSnapshot; onStatusChange: (status: SimulatedStatus) => void }) {
  const { status, confirmations } = snapshot;
  const { t } = useI18n();
  const label = (value: SimulatedStatus) => t(`demo.status.${value}`);
  return (
    <section className="simulated-checkout-preview grid min-w-0 gap-4 rounded-surface border border-stroke bg-card p-5" aria-label={t("demo.previewLabel")}>
      <p className="font-semibold" role="status">{t("demo.simulatedNoPayment")}</p>
      <label className="grid gap-2 text-sm font-semibold">{t("demo.previewState")}
        <select className="min-h-11 w-full min-w-0 rounded-xl border border-stroke bg-white px-3" value={status} onChange={event => onStatusChange(event.target.value as SimulatedStatus)}>
          {simulatedStatuses.filter(value => target !== 0 || value !== "payment_detected").map(value => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </label>
      {target === 0 ? <p className="text-sm">{t("demo.zeroTarget")}</p> : null}
      <div aria-live="polite" aria-atomic="true" className="grid gap-3">
        <StatusBadge label={label(status)} tone={status === "confirmed" ? "success" : status === "payment_detected" ? "detected" : status === "pending" ? "pending" : "error"} />
        <p className="break-words font-mono text-2xl font-semibold">{amount} XMR</p>
        {description ? <p className="break-words">{description}</p> : null}
        <p>{t("demo.exampleConfirmations", { done: confirmations, target })}</p>
        <p>{status === "expired" || status === "invalid" ? t("demo.doNotSend") : status === "pending" ? t("demo.instructionsHere") : t("demo.noFurther")}</p>
      </div>
      <div className="grid min-h-32 place-items-center rounded-xl border-2 border-dashed border-stroke p-4 text-center text-sm">{t("demo.qrPlaceholder")}</div>
      <p className="text-sm">{t("demo.noAddress")}</p>
      <p className="break-words text-sm">{t("demo.exampleExpiry", { expiry: expiry ?? t("dashboard.invoices.sixtyMinutes") })}</p>
    </section>
  );
}
