export type SimulatedStatus = "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
export const simulatedStatuses: SimulatedStatus[] = ["pending", "payment_detected", "confirmed", "expired", "invalid"];
// Timeline events are message keys under "demo.timeline" so the UI can translate them.
export type SimulatedEvent = "created" | "detected" | "confirmed" | "expired" | "invalid";
export function simulatedInvoice(status: SimulatedStatus, target: number, createdAt = "2026-01-01T12:00:00.000Z", expiresAt?: string | null) {
  const effectiveStatus = target === 0 && status === "payment_detected" ? "confirmed" : status;
  const time = (minutes: number) => new Date(Date.parse(createdAt) + minutes * 60000).toISOString();
  const timeline: { event: SimulatedEvent; value: string }[] = [{ event: "created", value: createdAt }];
  if (effectiveStatus === "payment_detected" || effectiveStatus === "confirmed") timeline.push({ event: "detected", value: time(1) });
  if (effectiveStatus === "confirmed") timeline.push({ event: "confirmed", value: time(2) });
  if (effectiveStatus === "expired") timeline.push({ event: "expired", value: expiresAt || time(60) });
  if (effectiveStatus === "invalid") timeline.push({ event: "invalid", value: time(2) });
  return { status: effectiveStatus, target, confirmations: effectiveStatus === "confirmed" ? target : effectiveStatus === "payment_detected" ? Math.max(0, target - 1) : 0, timeline };
}
export type SimulatedSnapshot = ReturnType<typeof simulatedInvoice>;
// Fixed example prices of 1 XMR in fiat, used only by demo pages.
export const demoRates: Record<string, number> = { USD: 200, EUR: 180, GBP: 160 };
