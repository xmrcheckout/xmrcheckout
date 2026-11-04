import Link from "next/link";
import { cookies } from "next/headers";
import { utcTimestamp } from "../lib/timestamps";
import { getI18n } from "../lib/i18n/server";
import InvoiceAddressAvailability from "./invoice-address-availability";
import TerminalEditor, { type TerminalData } from "./terminal-editor";

export default async function Terminals() {
  const { t } = await getI18n();
  const key = (await cookies()).get("xmrcheckout_api_key")?.value;
  const base = process.env.API_BASE_URL ?? "http://localhost:8000";
  const headers = { Authorization: `ApiKey ${key}` };
  const [response, usageResponse, addressResponse] = await Promise.all([
    fetch(`${base}/api/core/terminals`, { headers, cache: "no-store" }).catch(() => null),
    fetch(`${base}/api/core/payment-links/status`, { headers, cache: "no-store" }).catch(() => null),
    fetch(`${base}/api/core/subaddresses/status`, { headers, cache: "no-store" }).catch(() => null),
  ]);
  if (!response?.ok) return <section><h1 className="font-sans text-2xl font-semibold">Terminals</h1><p role="alert">Terminals are unavailable. Refresh to try again.</p></section>;
  const terminals: TerminalData[] = (await response.json()).terminals;
  const usage = usageResponse?.ok ? await usageResponse.json() : null;
  const currencies: string[] = usage?.supported_currencies ?? [];
  const addressStatus = addressResponse?.ok ? await addressResponse.json() : null;
  return <section className="grid min-w-0 gap-6">
    <div><h1 className="font-sans text-2xl font-semibold sm:text-3xl">Terminals</h1>
      <p className="mt-2 text-ink-soft">Take Monero in person. Open a terminal link on a tablet or phone at your till, type the amount, and the customer scans the QR code with their wallet. Each sale is a normal XMR invoice paid directly to your wallet.</p>
      <p className="mt-2 text-sm text-ink-soft">Each sale uses one of your invoice addresses. Unpaid and cancelled sales hold their address for three days, so a busy till can run low. The terminal warns when fewer than 20 are free.</p>
      <p className="mt-3"><Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/in-person-monero-checkout">In-person checkout guide</Link></p>
    </div>
    <InvoiceAddressAvailability status={addressStatus} showRefresh={false} compact={Boolean(addressStatus && addressStatus.counts.never_issued + addressStatus.counts.eligible_for_reuse > 0 && addressStatus.counts.needs_review === 0 && addressStatus.snapshot?.outcome !== "failed")} />
    <details className="rounded-2xl border border-stroke p-5"><summary className="min-h-11 cursor-pointer font-semibold">Create terminal</summary><TerminalEditor currencies={currencies} /></details>
    {terminals.length === 0 ? <p>No terminals yet.</p> : terminals.map(terminal => <article key={terminal.id} className="grid min-w-0 gap-3 rounded-2xl border border-stroke p-5">
      <h3 className="break-words text-xl font-semibold">{terminal.name} · {terminal.enabled ? "Enabled" : "Disabled"}</h3>
      <p>{terminal.default_currency} default · {terminal.confirmation_target === 0 ? "No confirmations required" : `${terminal.confirmation_target} confirmation${terminal.confirmation_target === 1 ? "" : "s"}`} · Expires after {terminal.expiry_minutes} minutes</p>
      <p className="text-sm text-ink-soft">Last used: {terminal.last_used_at ? utcTimestamp(terminal.last_used_at, t) : "never"}</p>
      <details><summary className="min-h-11 cursor-pointer font-semibold">Edit settings or create a new link</summary><TerminalEditor terminal={terminal} currencies={currencies} /></details>
    </article>)}
  </section>;
}
