"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { savePaymentLink, savePaymentLinkTourAction, type PaymentLinkState } from "../app/(app)/dashboard/payment-link-actions";
import { rich } from "../lib/i18n/rich";
import { useI18n } from "./i18n-provider";

export type PaymentLinkData = {
  button_text: string; id: string; title: string; description: string; amount_xmr: string | null;
  amount_fiat: string | null; currency: string | null; confirmation_target: number;
  auto_create_invoice: boolean; checkout_continue_url: string | null; confirmation_message: string | null; enabled: boolean; url: string; action_url: string;
  customer_amount: boolean; minimum_amount_xmr: string | null;
};
const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-ink";
function Buttons({ canDisable }: { canDisable: boolean }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return <div className="flex flex-wrap gap-3"><button disabled={pending} className="min-h-11 rounded-full bg-ink px-5 py-2 text-cream disabled:opacity-60">{pending ? t("common.saving") : t("paymentLinks.editor.save")}</button>{canDisable ? <button disabled={pending} formNoValidate name="mode" value="disable" className="min-h-11 rounded-full border border-stroke px-5 py-2">{t("paymentLinks.editor.disable")}</button> : null}</div>;
}
export default function PaymentLinkEditor({ link, defaultTarget = 1, currencies, mode = "live" }: { link?: PaymentLinkData; defaultTarget?: number; currencies: string[] | null; mode?: "live" | "tour" }) {
  const { t } = useI18n();
  const empty = { button_text: t("paymentLinks.editor.defaultButton"), title: "", description: "", amount: "", currency: "XMR", confirmation_target: String(defaultTarget), checkout_continue_url: "", confirmation_message: "", minimum_amount_xmr: "" };
  const [values, setValues] = useState(link ? { button_text: link.button_text, title: link.title, description: link.description, amount: link.amount_xmr ?? link.amount_fiat ?? "", currency: link.currency ?? "XMR", confirmation_target: String(link.confirmation_target), checkout_continue_url: link.checkout_continue_url ?? "", confirmation_message: link.confirmation_message ?? "", minimum_amount_xmr: link.minimum_amount_xmr ?? "" } : empty);
  const [customerAmount, setCustomerAmount] = useState(link?.customer_amount ?? false);
  const [automatic, setAutomatic] = useState(link?.auto_create_invoice ?? false);
  const [enabled, setEnabled] = useState(link?.enabled ?? true);
  const [state, action] = useFormState<PaymentLinkState, FormData>(async (previous, data) => {
    const result = await (mode === "tour" ? savePaymentLinkTourAction : savePaymentLink)(previous, data);
    if (result.success && !link) { setValues(empty); setEnabled(true); setAutomatic(false); setCustomerAmount(false); }
    if (result.disabled) setEnabled(false);
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
  // All fields are controlled; creation resets them explicitly after success.
  // Native action resets can otherwise undo a saved checkbox's visible state.
  return <form ref={form} action={action} onReset={event => event.preventDefault()} className="grid min-w-0 gap-4">
    <input type="hidden" name="id" value={link?.id ?? ""} />
    <div><label htmlFor={`${prefix}-title`}>{t("paymentLinks.editor.title")}</label><input {...props("title")} required maxLength={200} />{error("title")}</div>
    <div><label htmlFor={`${prefix}-button_text`}>{t("paymentLinks.editor.buttonText")}</label><input {...props("button_text")} required maxLength={32} />{error("button_text")}
      <p className="mt-2 text-sm text-ink-soft">{t("paymentLinks.editor.buttonTextHelp")}</p>
    </div>
    <div><label htmlFor={`${prefix}-description`}>{t("paymentLinks.editor.description")}</label><textarea {...props("description")} maxLength={2000} />{error("description")}</div>
    <fieldset className="grid gap-2"><legend>{t("paymentLinks.editor.amount")}</legend>
      <label className="flex min-h-11 items-center gap-3"><input type="radio" name="amount_mode" value="fixed" checked={!customerAmount} onChange={() => setCustomerAmount(false)} />{t("paymentLinks.editor.fixedBySeller")}</label>
      <label className="flex min-h-11 items-center gap-3"><input type="radio" name="amount_mode" value="customer" checked={customerAmount} onChange={() => { setCustomerAmount(true); setAutomatic(false); }} />{t("paymentLinks.editor.customerEnters")}</label>
      <p className="text-sm text-ink-soft">{t("paymentLinks.editor.customerHelp")}</p>
    </fieldset>
    {customerAmount ? <div><label htmlFor={`${prefix}-minimum_amount_xmr`}>{t("paymentLinks.editor.minimum")}</label><input {...props("minimum_amount_xmr")} type="number" min="0.000000000001" step="any" />{error("minimum_amount_xmr")}
      <p className="mt-2 text-sm text-ink-soft">{t("paymentLinks.editor.minimumHelp")}</p>
    </div> : <><div className="grid gap-4 sm:grid-cols-2">
      <div><label htmlFor={`${prefix}-amount`}>{t("paymentLinks.editor.fixedAmount")}</label><input {...props("amount")} type="number" min="0.000000000001" step="any" required />{error("amount")}</div>
      <div><label htmlFor={`${prefix}-currency`}>{t("paymentLinks.editor.amountCurrency")}</label><select {...props("currency")}><option>XMR</option>{unknown ? <option value={values.currency}>{values.currency} — {currencies ? t("paymentLinks.editor.unsupported") : t("paymentLinks.editor.unverified")}</option> : null}{currencies?.map(currency => <option key={currency}>{currency}</option>)}</select>{error("currency")}</div>
    </div>
    {unknown && currencies ? <p className="text-sm text-red-700">{t("paymentLinks.editor.chooseSupported")}</p> : null}
    {!currencies ? <p role="status">{t("paymentLinks.editor.currenciesUnavailable")}</p> : null}</>}
    <p className="text-sm text-ink-soft">{t("paymentLinks.editor.fiatNote")}</p>
    <div><label htmlFor={`${prefix}-confirmation_target`}>{t("settings.requiredConfirmations")}</label><input {...props("confirmation_target")} type="number" min="0" max="10" step="1" required />{error("confirmation_target")}</div>
    <p className="text-sm text-ink-soft">{t("paymentLinks.editor.zeroConf")}</p>
    <div><label htmlFor={`${prefix}-checkout_continue_url`}>{t("paymentLinks.editor.returnUrl")}</label><input {...props("checkout_continue_url")} type="url" placeholder="https://your-site.example/thanks" />{error("checkout_continue_url")}
      <p className="mt-2 text-sm text-ink-soft">{t("paymentLinks.editor.returnUrlHelp")}</p>
    </div>
    <div><label htmlFor={`${prefix}-confirmation_message`}>{t("paymentLinks.editor.message")}</label><textarea {...props("confirmation_message")} maxLength={2000} rows={4} placeholder={t("paymentLinks.editor.messagePlaceholder")} />{error("confirmation_message")}
      <p className="mt-2 text-sm text-ink-soft">{t("paymentLinks.editor.messageHelp")} {rich(t("paymentLinks.editor.messageHelpTail"), { link: (text) => <a className="underline underline-offset-4" href="/guides/monero-payment-buttons#confirmation-message">{text}</a> })}</p>
    </div>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" checked={enabled} onChange={event => setEnabled(event.target.checked)} />{t("paymentLinks.editor.enableNew")}</label>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="auto_create_invoice" checked={automatic} disabled={customerAmount} onChange={event => setAutomatic(event.target.checked)} />{t("paymentLinks.editor.autoCreate")}</label>
    {customerAmount ? <p className="text-sm text-ink-soft">{t("paymentLinks.editor.autoUnavailable")}</p> : null}
    <p className="text-sm text-ink-soft">{t("paymentLinks.editor.autoWarning")}</p>
    <p className="text-sm text-ink-soft">{t("paymentLinks.editor.disableNote")}</p>
    <p role="status" className={state.error ? "text-red-700" : "text-ink"}>{state.error || state.success}</p>
    <Buttons canDisable={!!link?.enabled} />
  </form>;
}
