"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import QRCode from "qrcode";
import { saveTerminal, type TerminalState } from "../app/(app)/dashboard/terminal-actions";
import ConfirmSubmitButton from "./confirm-submit-button";
import CopyCodeBlock from "./copy-code-block";

export type TerminalData = {
  id: string; name: string; default_currency: string; confirmation_target: number;
  expiry_minutes: number; enabled: boolean; created_at: string | null; last_used_at: string | null;
};
const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-ink";

function SaveButton({ existing }: { existing: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 justify-self-start rounded-full bg-ink px-5 py-2 text-cream disabled:opacity-60">{pending ? "Saving…" : existing ? "Save terminal" : "Create terminal"}</button>;
}

function NewLink({ url }: { url: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null)); }, [url]);
  return <div className="grid min-w-0 gap-3 rounded-xl border border-clay bg-white/70 p-4">
    <p className="font-semibold">Open this link on the device at your till. It is shown only once.</p>
    <p className="text-sm text-ink-soft">Anyone with this link can create invoices to your wallet and see their status. It cannot move funds or open your dashboard. Create a new link if it is lost.</p>
    {qr ? <Image src={qr} alt="QR code for the terminal link" width={200} height={200} unoptimized className="rounded-lg bg-white" /> : null}
    <CopyCodeBlock className="overflow-x-auto rounded-xl bg-ink p-5 pt-16 font-mono text-sm text-cream">{url}</CopyCodeBlock>
  </div>;
}

export default function TerminalEditor({ terminal, currencies }: { terminal?: TerminalData; currencies: string[] }) {
  const [state, action] = useFormState<TerminalState, FormData>(saveTerminal, { error: "", success: "", url: "" });
  const [rotated, rotate] = useFormState<TerminalState, FormData>(saveTerminal, { error: "", success: "", url: "" });
  const prefix = useId();
  return <div className="grid min-w-0 gap-6"><form action={action} className="grid min-w-0 gap-4">
    <input type="hidden" name="id" value={terminal?.id ?? ""} />
    <div><label htmlFor={`${prefix}-name`}>Name</label><input id={`${prefix}-name`} name="name" defaultValue={terminal?.name ?? ""} required maxLength={100} placeholder="Front counter" className={inputClass} /></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <div><label htmlFor={`${prefix}-currency`}>Default currency</label><select id={`${prefix}-currency`} name="default_currency" defaultValue={terminal?.default_currency ?? "XMR"} className={inputClass}>
        <option>XMR</option>{currencies.map(code => <option key={code}>{code}</option>)}</select></div>
      <div><label htmlFor={`${prefix}-target`}>Required confirmations</label><input id={`${prefix}-target`} name="confirmation_target" type="number" min={0} max={10} defaultValue={terminal?.confirmation_target ?? 0} required className={inputClass} /></div>
      <div><label htmlFor={`${prefix}-expiry`}>Invoice expiry (minutes)</label><input id={`${prefix}-expiry`} name="expiry_minutes" type="number" min={2} max={60} defaultValue={terminal?.expiry_minutes ?? 15} required className={inputClass} /></div>
    </div>
    <p className="text-sm text-ink-soft">Zero confirmations shows “Payment seen” as soon as the payment reaches the network, usually within seconds. It is not yet in a block and could in rare cases fail to confirm. Use one or more confirmations (about two minutes each) for larger amounts.</p>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={terminal?.enabled ?? true} />Enabled</label>
    <p role="status" className={state.error ? "text-red-700" : "text-ink"}>{state.error || state.success}</p>
    {state.url ? <NewLink url={state.url} /> : null}
    <SaveButton existing={!!terminal} />
  </form>
  {terminal ? <form action={rotate} className="grid min-w-0 gap-3 border-t border-stroke pt-4">
    <input type="hidden" name="id" value={terminal.id} />
    <input type="hidden" name="mode" value="rotate" />
    <p className="text-sm text-ink-soft">Lost the device or the link? Create a new link. The current link stops working immediately.</p>
    <ConfirmSubmitButton label="Create new link" confirmLabel="Replace link" description="The device using the current link will stop working until you open the new link on it." />
    <p role="status" className={rotated.error ? "text-red-700" : "text-ink"}>{rotated.error || rotated.success}</p>
    {rotated.url ? <NewLink url={rotated.url} /> : null}
  </form> : null}</div>;
}
