"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import QRCode from "qrcode";
import { saveTerminal, saveTerminalTourAction, type TerminalState } from "../app/(app)/dashboard/terminal-actions";
import ConfirmSubmitButton from "./confirm-submit-button";
import CopyCodeBlock from "./copy-code-block";
import { useI18n } from "./i18n-provider";

export type TerminalData = {
  id: string; name: string; default_currency: string; confirmation_target: number;
  expiry_minutes: number; enabled: boolean; created_at: string | null; last_used_at: string | null;
};
const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-4 py-3 text-ink";

function SaveButton({ existing }: { existing: boolean }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 justify-self-start rounded-full bg-ink px-5 py-2 text-cream disabled:opacity-60">{pending ? t("common.saving") : existing ? t("terminals.save") : t("terminals.create")}</button>;
}

function NewLink({ url }: { url: string }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null)); }, [url]);
  return <div className="grid min-w-0 gap-3 rounded-xl border border-clay bg-white/70 p-4">
    <p className="font-semibold">{t("terminals.linkOnce")}</p>
    <p className="text-sm text-ink-soft">{t("terminals.linkWarning")}</p>
    {qr ? <Image src={qr} alt={t("terminals.linkQrAlt")} width={200} height={200} unoptimized className="rounded-lg bg-white" /> : null}
    <CopyCodeBlock className="overflow-x-auto rounded-xl bg-ink p-5 pt-16 font-mono text-sm text-cream">{url}</CopyCodeBlock>
  </div>;
}

export default function TerminalEditor({ terminal, currencies, mode = "live" }: { terminal?: TerminalData; currencies: string[]; mode?: "live" | "tour" }) {
  const save = mode === "tour" ? saveTerminalTourAction : saveTerminal;
  const { t } = useI18n();
  const empty = { name: "", default_currency: "XMR", confirmation_target: "0", expiry_minutes: "15" };
  const [values, setValues] = useState(terminal ? { name: terminal.name, default_currency: terminal.default_currency, confirmation_target: String(terminal.confirmation_target), expiry_minutes: String(terminal.expiry_minutes) } : empty);
  const [enabled, setEnabled] = useState(terminal?.enabled ?? true);
  const field = (name: keyof typeof values) => ({ value: values[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues(current => ({ ...current, [name]: event.target.value })) });
  const [state, action] = useFormState<TerminalState, FormData>(async (previous, data) => {
    const result = await save(previous, data);
    if (result.success && !terminal) { setValues(empty); setEnabled(true); }
    return result;
  }, { error: "", success: "", url: "" });
  const [rotated, rotate] = useFormState<TerminalState, FormData>(save, { error: "", success: "", url: "" });
  const prefix = useId();
  return <div className="grid min-w-0 gap-6"><form action={action} onReset={event => event.preventDefault()} className="grid min-w-0 gap-4">
    <input type="hidden" name="id" value={terminal?.id ?? ""} />
    <div><label htmlFor={`${prefix}-name`}>{t("terminals.name")}</label><input id={`${prefix}-name`} name="name" {...field("name")} required maxLength={100} placeholder={t("terminals.namePlaceholder")} className={inputClass} /></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <div><label htmlFor={`${prefix}-currency`}>{t("terminals.defaultCurrency")}</label><select id={`${prefix}-currency`} name="default_currency" {...field("default_currency")} className={inputClass}>
        <option>XMR</option>{currencies.map(code => <option key={code}>{code}</option>)}</select></div>
      <div><label htmlFor={`${prefix}-target`}>{t("settings.requiredConfirmations")}</label><input id={`${prefix}-target`} name="confirmation_target" type="number" min={0} max={10} {...field("confirmation_target")} required className={inputClass} /></div>
      <div><label htmlFor={`${prefix}-expiry`}>{t("terminals.expiryMinutes")}</label><input id={`${prefix}-expiry`} name="expiry_minutes" type="number" min={2} max={60} {...field("expiry_minutes")} required className={inputClass} /></div>
    </div>
    <p className="text-sm text-ink-soft">{t("terminals.zeroConfNote")}</p>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" checked={enabled} onChange={event => setEnabled(event.target.checked)} />{t("terminals.enabled")}</label>
    <p role="status" className={state.error ? "text-red-700" : "text-ink"}>{state.error || state.success}</p>
    {state.url ? <NewLink url={state.url} /> : null}
    <SaveButton existing={!!terminal} />
  </form>
  {terminal ? <form action={rotate} className="grid min-w-0 gap-3 border-t border-stroke pt-4">
    <input type="hidden" name="id" value={terminal.id} />
    <input type="hidden" name="mode" value="rotate" />
    <p className="text-sm text-ink-soft">{t("terminals.lostDevice")}</p>
    <ConfirmSubmitButton pendingLabel={t("terminals.replacing")} label={t("terminals.newLink")} confirmLabel={t("terminals.replaceLink")} description={t("terminals.replaceDescription")} />
    <p role="status" className={rotated.error ? "text-red-700" : "text-ink"}>{rotated.error || rotated.success}</p>
    {rotated.url ? <NewLink url={rotated.url} /> : null}
  </form> : null}</div>;
}
