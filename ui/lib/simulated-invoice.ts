export type SimulatedStatus = "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
export const simulationLabels: Record<SimulatedStatus, string> = {
  pending: "Awaiting payment", payment_detected: "Payment detected", confirmed: "Confirmed", expired: "Expired", invalid: "Invalid",
};
export function simulatedInvoice(status: SimulatedStatus, target: number, createdAt = "2026-01-01T12:00:00.000Z", expiresAt?: string | null) {
  const effectiveStatus = target === 0 && status === "payment_detected" ? "confirmed" : status;
  const time = (minutes: number) => new Date(Date.parse(createdAt) + minutes * 60000).toISOString();
  const timeline = [{ label: "Invoice created", value: createdAt }];
  if (effectiveStatus === "payment_detected" || effectiveStatus === "confirmed") timeline.push({ label: "Payment detected", value: time(1) });
  if (effectiveStatus === "confirmed") timeline.push({ label: "Payment confirmed", value: time(2) });
  if (effectiveStatus === "expired") timeline.push({ label: "Invoice expired", value: expiresAt || time(60) });
  if (effectiveStatus === "invalid") timeline.push({ label: "Invoice marked invalid", value: time(2) });
  return { status: effectiveStatus, target, confirmations: effectiveStatus === "confirmed" ? target : effectiveStatus === "payment_detected" ? Math.max(0, target - 1) : 0, timeline };
}
export type SimulatedSnapshot = ReturnType<typeof simulatedInvoice>;
