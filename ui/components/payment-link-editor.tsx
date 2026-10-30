"use client";

import { useFormState, useFormStatus } from "react-dom";
import { savePaymentLink } from "../app/(app)/dashboard/payment-link-actions";
import { FIAT_CURRENCY_SUGGESTIONS } from "../lib/fiat-currencies";

export type PaymentLinkData = {
  id: string; title: string; description: string; amount_xmr: string | null;
  amount_fiat: string | null; currency: string | null; confirmation_target: number;
  checkout_continue_url: string | null; enabled: boolean; url: string; action_url: string;
};
const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-ink";
function SaveButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-full bg-ink px-5 py-2 text-cream disabled:opacity-60">{pending ? "Saving…" : "Save payment link"}</button>;
}
export default function PaymentLinkEditor({ link, defaultTarget = 1 }: { link?: PaymentLinkData; defaultTarget?: number }) {
  const [state, action] = useFormState(savePaymentLink, { error: "", success: "" });
  return <form action={action} className="grid min-w-0 gap-4">
    <input type="hidden" name="id" value={link?.id ?? ""} />
    <label>Title<input name="title" required maxLength={200} defaultValue={link?.title} className={inputClass} /></label>
    <label>Description<textarea name="description" maxLength={2000} defaultValue={link?.description} className={inputClass} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>Fixed amount<input name="amount" type="number" min="0.000000000001" step="any" required defaultValue={link?.amount_xmr ?? link?.amount_fiat ?? ""} className={inputClass} /></label>
      <label>Amount currency<select name="currency" defaultValue={link?.currency ?? "XMR"} className={inputClass}><option>XMR</option>{FIAT_CURRENCY_SUGGESTIONS.map(currency => <option key={currency}>{currency}</option>)}</select></label>
    </div>
    <p className="text-sm text-ink-soft">Fiat-reference amounts are converted to XMR when each invoice is created. Estimates do not lock rates or guarantee a fiat outcome.</p>
    <label>Required confirmations<input name="confirmation_target" type="number" min="0" max="10" step="1" required defaultValue={link?.confirmation_target ?? defaultTarget} className={inputClass} /></label>
    <p className="text-sm text-ink-soft">Zero confirmations accepts detection without waiting for a block confirmation.</p>
    <label>Merchant return URL (optional)<input name="checkout_continue_url" type="url" defaultValue={link?.checkout_continue_url ?? ""} placeholder="https://your-site.example/thanks" className={inputClass} /></label>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={link?.enabled ?? true} />Enable new purchases</label>
    <p className="text-sm text-ink-soft">Disabling stops new purchases. Existing invoices continue to be checked.</p>
    <p role="status" className={state.error ? "text-red-700" : "text-ink"}>{state.error || state.success}</p>
    <div><SaveButton /></div>
  </form>;
}
