import type { StatusTone } from "../components/status-badge";
import type { Translate } from "./i18n/translate";

export const invoiceStatuses = [
  "pending",
  "partially_paid",
  "payment_detected",
  "confirmed",
  "expired",
  "invalid",
] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];

/** Plain status name, e.g. "Awaiting funds". */
export const invoiceStatusName = (status: InvoiceStatus, t: Translate): string =>
  t(`invoiceStatus.${status}`);

export const invoiceStatusTones: Record<InvoiceStatus, StatusTone> = {
  pending: "pending",
  partially_paid: "pending",
  payment_detected: "detected",
  confirmed: "success",
  expired: "error",
  invalid: "error",
};

const parseAmount = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** True when some, but not all, of the requested amount was received. */
export const hasPartialAmount = (
  amountPaidXmr: string | null | undefined,
  amountRemainingXmr: string | null | undefined,
): boolean =>
  parseAmount(amountPaidXmr) > 0 && parseAmount(amountRemainingXmr) > 0;

/** Badge label that keeps an underpaid expiry visible to the merchant. */
export const invoiceStatusLabel = (
  status: InvoiceStatus,
  amountPaidXmr: string | null | undefined,
  amountRemainingXmr: string | null | undefined,
  t: Translate,
): string =>
  status === "expired" && hasPartialAmount(amountPaidXmr, amountRemainingXmr)
    ? t("invoiceStatus.expiredUnderpaid")
    : invoiceStatusName(status, t);
