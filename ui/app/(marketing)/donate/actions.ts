"use server";

import { areDonationsEnabled } from "../../../lib/donations";
import { getI18n } from "../../../lib/i18n/server";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

export type DonationState = {
  error: string | null;
  invoiceId: string | null;
};

export async function createDonationAction(
  _prevState: DonationState,
  formData: FormData
): Promise<DonationState> {
  const { t } = await getI18n();
  if (!areDonationsEnabled()) {
    return { error: t("donate.disabled"), invoiceId: null };
  }
  const amount = Number(formData.get("amount_xmr"));
  if (Number.isNaN(amount) || amount <= 0) {
    return { error: t("donate.invalidAmount"), invoiceId: null };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/core/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_xmr: amount }),
      cache: "no-store",
    });
  } catch {
    return {
      error: t("donate.serviceUnavailable"),
      invoiceId: null,
    };
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const reference = typeof detail?.diagnostic_id === "string" ? ` ${t("donate.reference", { id: detail.diagnostic_id })}` : "";
    const message = `${t("donate.creationUnavailable")}${reference}`;
    return { error: message, invoiceId: null };
  }

  const data = (await response.json()) as { id: string };
  return { error: null, invoiceId: data.id };
}
