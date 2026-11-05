import Link from "next/link";
import { cookies } from "next/headers";
import { utcTimestamp } from "../lib/timestamps";
import { getI18n } from "../lib/i18n/server";
import InvoiceAddressAvailability, { type SubaddressStatus } from "./invoice-address-availability";
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
  if (!response?.ok) return <section><h1 className="font-sans text-2xl font-semibold">{t("terminals.title")}</h1><p role="alert">{t("terminals.unavailable")}</p></section>;
  const terminals: TerminalData[] = (await response.json()).terminals;
  const usage = usageResponse?.ok ? await usageResponse.json() : null;
  const addressStatus: SubaddressStatus | null = addressResponse?.ok ? await addressResponse.json() : null;
  return <TerminalsView terminals={terminals} currencies={usage?.supported_currencies ?? []} addressStatus={addressStatus} />;
}

export async function TerminalsView({ terminals, currencies, addressStatus, mode = "live" }: {
  terminals: TerminalData[]; currencies: string[]; addressStatus: SubaddressStatus | null; mode?: "live" | "tour";
}) {
  const { t } = await getI18n();
  const tour = mode === "tour";
  return <section className="grid min-w-0 gap-6">
    <div><h1 className="font-sans text-2xl font-semibold sm:text-3xl">{t("terminals.title")}</h1>
      <p className="mt-2 text-ink-soft">{t("terminals.intro")}</p>
      <p className="mt-2 text-sm text-ink-soft">{t("terminals.addressNote")}</p>
      <p className="mt-3"><Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/in-person-monero-checkout">{t("terminals.guide")}</Link></p>
    </div>
    {tour ? <div className="grid justify-items-start gap-3 border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">
      <p>{t("terminals.demoNote")}</p>
      <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2" href="/terminal/demo">{t("terminals.demoTill")}</Link>
    </div> : null}
    {tour ? null : <InvoiceAddressAvailability status={addressStatus} showRefresh={false} compact={Boolean(addressStatus && addressStatus.counts.never_issued + addressStatus.counts.eligible_for_reuse > 0 && addressStatus.counts.needs_review === 0 && addressStatus.snapshot?.outcome !== "failed")} />}

    <details className="rounded-2xl border border-stroke p-5"><summary className="min-h-11 cursor-pointer font-semibold">{t("terminals.create")}</summary><TerminalEditor currencies={currencies} mode={mode} /></details>
    {terminals.length === 0 ? <p>{t("terminals.none")}</p> : terminals.map(terminal => <article key={terminal.id} className="grid min-w-0 gap-3 rounded-2xl border border-stroke p-5">
      <h3 className="break-words text-xl font-semibold">{terminal.name} · {terminal.enabled ? t("terminals.enabled") : t("terminals.disabled")}</h3>
      <p>{t("terminals.summary", { currency: terminal.default_currency, confirmations: terminal.confirmation_target === 0 ? t("terminals.noConfirmations") : t("terminals.confirmationCount", { count: terminal.confirmation_target }), minutes: terminal.expiry_minutes })}</p>
      <p className="text-sm text-ink-soft">{t("terminals.lastUsed", { time: terminal.last_used_at ? utcTimestamp(terminal.last_used_at, t) : t("terminals.never") })}</p>
      <details><summary className="min-h-11 cursor-pointer font-semibold">{t("terminals.editOrRotate")}</summary><TerminalEditor terminal={terminal} currencies={currencies} mode={mode} /></details>
    </article>)}
  </section>;
}
