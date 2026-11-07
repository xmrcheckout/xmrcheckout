"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getI18n } from "../../../lib/i18n/server";

export type PaymentLinkState = { error: string; success: string; fieldErrors: Record<string, string>; disabled?: boolean; enabled?: boolean };
const fields: Record<string, string> = { title: "title", description: "description", button_text: "button_text", amount_xmr: "amount", amount_fiat: "amount", currency: "currency", confirmation_target: "confirmation_target", checkout_continue_url: "checkout_continue_url", confirmation_message: "confirmation_message", minimum_amount_xmr: "minimum_amount_xmr" };
export async function savePaymentLink(_state: PaymentLinkState, form: FormData): Promise<PaymentLinkState> {
  const { t } = await getI18n();
  const fieldErrors: Record<string, string> = {};
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) return { error: t("dashboard.paymentLinkActions.connectFirst"), success: "", fieldErrors };
  const id = String(form.get("id") ?? "");
  const currency = String(form.get("currency") ?? "XMR");
  const disabling = form.get("mode") === "disable" && !!id;
  const enabling = form.get("mode") === "enable" && !!id;
  const customerAmount = form.get("amount_mode") === "customer";
  try {
    const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:8000"}/api/core/payment-links${id ? `/${encodeURIComponent(id)}` : ""}`, {
      method: id ? "PATCH" : "POST", cache: "no-store",
      headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(disabling || enabling ? { enabled: enabling } : { title: form.get("title"), description: form.get("description"),
        customer_amount: customerAmount,
        minimum_amount_xmr: customerAmount ? String(form.get("minimum_amount_xmr") ?? "").trim() || null : null,
        amount_xmr: customerAmount || currency !== "XMR" ? null : form.get("amount"),
        amount_fiat: customerAmount || currency === "XMR" ? null : form.get("amount"), currency: customerAmount || currency === "XMR" ? null : currency,
        confirmation_target: Number(form.get("confirmation_target")),
        checkout_continue_url: String(form.get("checkout_continue_url") ?? "").trim() || null,
        confirmation_message: String(form.get("confirmation_message") ?? "").trim() || null,
        button_text: form.get("button_text"),
        auto_create_invoice: !customerAmount && form.get("auto_create_invoice") === "on",
        enabled: !id || form.get("enabled") === "on" }),
    });
    if (response.status === 401) return { error: t("dashboard.actions.authExpired"), success: "", fieldErrors };
    if (response.status >= 500) return { error: t("dashboard.paymentLinkActions.notConfirmed"), success: "", fieldErrors };
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (Array.isArray(data?.detail)) for (const issue of data.detail) {
        const field = Array.isArray(issue.loc) ? issue.loc.findLast((part: string) => Object.hasOwn(fields, part)) : null;
        if (field && !fieldErrors[fields[field]]) fieldErrors[fields[field]] = typeof issue.msg === "string" ? issue.msg.replace(/^Value error, /, "") : t("dashboard.paymentLinkActions.checkField");
      }
      const general = Array.isArray(data?.detail) && Object.keys(fieldErrors).length === 0 && typeof data.detail[0]?.msg === "string" ? data.detail[0].msg.replace(/^Value error, /, "") : null;
      return { error: typeof data?.detail === "string" ? data.detail : general ?? t("dashboard.paymentLinkActions.checkFields"), success: "", fieldErrors };
    }
    revalidatePath("/dashboard");
    return { error: "", success: disabling ? t("dashboard.paymentLinkActions.disabled") : enabling ? t("dashboard.paymentLinkActions.enabled") : t("dashboard.paymentLinkActions.saved"), fieldErrors, disabled: disabling, enabled: enabling };
  } catch {
    return { error: t("dashboard.paymentLinkActions.notConfirmed"), success: "", fieldErrors };
  }
}

export async function savePaymentLinkTourAction(_state: PaymentLinkState, _form: FormData): Promise<PaymentLinkState> {
  const { t } = await getI18n();
  return { error: "", success: t("dashboard.actions.tourNoop"), fieldErrors: {} };
}
