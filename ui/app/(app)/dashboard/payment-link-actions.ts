"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type PaymentLinkState = { error: string; success: string; fieldErrors: Record<string, string> };
const fields: Record<string, string> = { title: "title", description: "description", amount_xmr: "amount", amount_fiat: "amount", currency: "currency", confirmation_target: "confirmation_target", checkout_continue_url: "checkout_continue_url" };
export async function savePaymentLink(_state: PaymentLinkState, form: FormData): Promise<PaymentLinkState> {
  const fieldErrors: Record<string, string> = {};
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) return { error: "Sign in before saving a payment link.", success: "", fieldErrors };
  const id = String(form.get("id") ?? "");
  const currency = String(form.get("currency") ?? "XMR");
  const disabling = form.get("mode") === "disable" && !!id;
  try {
    const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:8000"}/api/core/payment-links${id ? `/${encodeURIComponent(id)}` : ""}`, {
      method: id ? "PATCH" : "POST", cache: "no-store",
      headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(disabling ? { enabled: false } : { title: form.get("title"), description: form.get("description"),
        amount_xmr: currency === "XMR" ? form.get("amount") : null,
        amount_fiat: currency === "XMR" ? null : form.get("amount"), currency: currency === "XMR" ? null : currency,
        confirmation_target: Number(form.get("confirmation_target")),
        checkout_continue_url: String(form.get("checkout_continue_url") ?? "").trim() || null,
        enabled: form.get("enabled") === "on" }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (Array.isArray(data?.detail)) for (const issue of data.detail) {
        const field = Array.isArray(issue.loc) ? issue.loc.findLast((part: string) => Object.hasOwn(fields, part)) : null;
        if (field && !fieldErrors[fields[field]]) fieldErrors[fields[field]] = typeof issue.msg === "string" ? issue.msg.replace(/^Value error, /, "") : "Check this field.";
      }
      return { error: typeof data?.detail === "string" ? data.detail : "Check the highlighted fields and payment-link settings.", success: "", fieldErrors };
    }
    revalidatePath("/dashboard");
    return { error: "", success: disabling ? "Payment link disabled." : "Payment link saved. Your copyable link and button are listed below.", fieldErrors };
  } catch {
    return { error: "Could not confirm saving. Check the payment-link list before trying again.", success: "", fieldErrors };
  }
}
