"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { savePaymentLink, type PaymentLinkState } from "../app/(app)/dashboard/payment-link-actions";

export type PaymentLinkData = {
  id: string; title: string; description: string; amount_xmr: string | null;
  amount_fiat: string | null; currency: string | null; confirmation_target: number;
  auto_create_invoice: boolean; checkout_continue_url: string | null; enabled: boolean; url: string; action_url: string;
};
const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-ink";
function Buttons({ canDisable }: { canDisable: boolean }) {
  const { pending } = useFormStatus();
  return <div className="flex flex-wrap gap-3"><button disabled={pending} className="min-h-11 rounded-full bg-ink px-5 py-2 text-cream disabled:opacity-60">{pending ? "Saving…" : "Save payment link"}</button>{canDisable ? <button disabled={pending} formNoValidate name="mode" value="disable" className="min-h-11 rounded-full border border-stroke px-5 py-2">Disable payment link</button> : null}</div>;
}
export default function PaymentLinkEditor({ link, defaultTarget = 1, currencies }: { link?: PaymentLinkData; defaultTarget?: number; currencies: string[] | null }) {
  const empty = { title: "", description: "", amount: "", currency: "XMR", confirmation_target: String(defaultTarget), checkout_continue_url: "" };
  const [values, setValues] = useState(link ? { title: link.title, description: link.description, amount: link.amount_xmr ?? link.amount_fiat ?? "", currency: link.currency ?? "XMR", confirmation_target: String(link.confirmation_target), checkout_continue_url: link.checkout_continue_url ?? "" } : empty);
  const [automatic, setAutomatic] = useState(link?.auto_create_invoice ?? false);
  const [enabled, setEnabled] = useState(link?.enabled ?? true);
  const [state, action] = useFormState<PaymentLinkState, FormData>(async (previous, data) => {
    const result = await savePaymentLink(previous, data);
    if (result.success && !link) { setValues(empty); setEnabled(true); setAutomatic(false); }
    if (result.success === "Payment link disabled.") setEnabled(false);
    return result;
  }, { error: "", success: "", fieldErrors: {} });
  const prefix = useId();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.error) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();

  }, [state, link, defaultTarget]);
  const props = (name: keyof typeof values) => ({ id: `${prefix}-${name}`, name, value: values[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(current => ({ ...current, [name]: event.target.value })), "aria-invalid": !!state.fieldErrors[name], "aria-describedby": state.fieldErrors[name] ? `${prefix}-${name}-error` : undefined, className: inputClass });
  const error = (name: string) => state.fieldErrors[name] ? <p id={`${prefix}-${name}-error`} className="text-sm text-red-700">{state.fieldErrors[name]}</p> : null;
  const unknown = values.currency !== "XMR" && !currencies?.includes(values.currency);
  return <form ref={form} action={action} className="grid min-w-0 gap-4">
    <input type="hidden" name="id" value={link?.id ?? ""} />
    <div><label htmlFor={`${prefix}-title`}>Title</label><input {...props("title")} required maxLength={200} />{error("title")}</div>
    <div><label htmlFor={`${prefix}-description`}>Description</label><textarea {...props("description")} maxLength={2000} />{error("description")}</div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label htmlFor={`${prefix}-amount`}>Fixed amount</label><input {...props("amount")} type="number" min="0.000000000001" step="any" required />{error("amount")}</div>
      <div><label htmlFor={`${prefix}-currency`}>Amount currency</label><select {...props("currency")}><option>XMR</option>{unknown ? <option value={values.currency}>{values.currency} — {currencies ? "unsupported" : "unverified"}</option> : null}{currencies?.map(currency => <option key={currency}>{currency}</option>)}</select>{error("currency")}</div>
    </div>
    {unknown && currencies ? <p className="text-sm text-red-700">Choose a supported currency before saving. You can still disable this link.</p> : null}
    {!currencies ? <p role="status">Currency choices are unavailable. Refresh to retrieve them; your saved settings are preserved.</p> : null}
    <p className="text-sm text-ink-soft">Fiat-reference amounts are converted to XMR when each invoice is created. Estimates do not lock rates or guarantee a fiat outcome.</p>
    <div><label htmlFor={`${prefix}-confirmation_target`}>Required confirmations</label><input {...props("confirmation_target")} type="number" min="0" max="10" step="1" required />{error("confirmation_target")}</div>
    <p className="text-sm text-ink-soft">Zero confirmations accepts detection without waiting for a block confirmation.</p>
    <div><label htmlFor={`${prefix}-checkout_continue_url`}>Merchant return URL (optional)</label><input {...props("checkout_continue_url")} type="url" placeholder="https://your-site.example/thanks" />{error("checkout_continue_url")}</div>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Enable new purchases</label>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="auto_create_invoice" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />Skip review and create invoice automatically</label>
    <p className="text-sm text-ink-soft">Visits can create unpaid invoices and consume your public invoice allowance and address capacity. Reopening in the same tab resumes the current invoice. Automated browsers can also trigger creation.</p>
    <p className="text-sm text-ink-soft">Disabling stops new purchases. Existing invoices continue to be checked.</p>
    <p role="status" className={state.error ? "text-red-700" : "text-ink"}>{state.error || state.success}</p>
    <Buttons canDisable={!!link?.enabled} />
  </form>;
}
