"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function savePaymentLink(_state: { error: string; success: string }, form: FormData) {
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) return { error: "Sign in before saving a payment link.", success: "" };
  const id = String(form.get("id") ?? "");
  const currency = String(form.get("currency") ?? "XMR");
  try {
    const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:8000"}/api/core/payment-links${id ? `/${encodeURIComponent(id)}` : ""}`, {
      method: id ? "PATCH" : "POST", cache: "no-store",
      headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.get("title"), description: form.get("description"),
        amount_xmr: currency === "XMR" ? form.get("amount") : null,
        amount_fiat: currency === "XMR" ? null : form.get("amount"), currency: currency === "XMR" ? null : currency,
        confirmation_target: Number(form.get("confirmation_target")),
        checkout_continue_url: String(form.get("checkout_continue_url") ?? "").trim() || null,
        enabled: form.get("enabled") === "on" }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { error: typeof data?.detail === "string" ? data.detail : "Check the title, amount, decimal places, confirmations, and return URL.", success: "" };
    }
    revalidatePath("/dashboard");
    return { error: "", success: "Payment link saved. Your copyable link and button are listed below." };
  } catch {
    return { error: "Could not confirm saving. Check the payment-link list before trying again.", success: "" };
  }
}
