import Link from "next/link";
import { cookies } from "next/headers";
import { utcTimestamp } from "../lib/timestamps";
import { getI18n } from "../lib/i18n/server";
import InvoiceAddressAvailability, { type SubaddressStatus } from "./invoice-address-availability";
import StatusBadge from "./status-badge";
import TerminalEditor, { type TerminalData } from "./terminal-editor";

type Translate = Awaited<ReturnType<typeof getI18n>>["t"];
type Mode = "live" | "tour";

const linkClass = "font-semibold underline decoration-clay underline-offset-4";
const listHref = (mode: Mode) => mode === "tour" ? "/tour?tab=terminals" : "/dashboard?tab=terminals";
const detailHref = (mode: Mode, id: string) => `${listHref(mode)}&terminal=${encodeURIComponent(id)}`;

const summary = (terminal: TerminalData, t: Translate) => t("terminals.summary", {
  currency: terminal.default_currency,
  confirmations: terminal.confirmation_target === 0 ? t("terminals.noConfirmations") : t("terminals.confirmationCount", { count: terminal.confirmation_target }),
  minutes: terminal.expiry_minutes,
});
const statusBadge = (terminal: TerminalData, t: Translate) =>
  <StatusBadge label={terminal.enabled ? t("terminals.enabled") : t("terminals.disabled")} tone={terminal.enabled ? "success" : "neutral"} />;
const lastUsed = (terminal: TerminalData, t: Translate) => terminal.last_used_at ? utcTimestamp(terminal.last_used_at, t) : t("terminals.never");

export default async function Terminals({ selectedId }: { selectedId?: string }) {
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
  return <TerminalsView terminals={terminals} currencies={usage?.supported_currencies ?? []} addressStatus={addressStatus} selectedId={selectedId} />;
}

export async function TerminalsView({ terminals, currencies, addressStatus, selectedId, mode = "live" }: {
  terminals: TerminalData[]; currencies: string[]; addressStatus: SubaddressStatus | null; selectedId?: string; mode?: Mode;
}) {
  const { t } = await getI18n();
  const tour = mode === "tour";
  const demoNote = tour ? <div className="grid justify-items-start gap-3 border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">
    <p>{t("terminals.demoNote")}</p>
    <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2" href="/terminal/demo">{t("terminals.demoTill")}</Link>
  </div> : null;
  const selected = selectedId ? terminals.find(terminal => terminal.id === selectedId) : undefined;
  if (selected) return <section className="grid min-w-0 gap-6">
    <div>
      <p><Link className={`inline-flex min-h-11 items-center ${linkClass}`} href={listHref(mode)}><span aria-hidden="true">←&nbsp;</span>{t("terminals.back")}</Link></p>
      <h1 className="mt-2 break-words font-sans text-2xl font-semibold sm:text-3xl">{selected.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-3">{statusBadge(selected, t)}<span>{summary(selected, t)}</span></p>
      <p className="mt-2 text-sm text-ink-soft">{t("terminals.lastUsed", { time: lastUsed(selected, t) })}</p>
    </div>
    {demoNote}
    <section aria-labelledby="terminal-settings-title" className="grid min-w-0 gap-3 rounded-2xl border border-stroke p-5">
      <h2 id="terminal-settings-title" className="font-sans text-xl font-semibold">{t("terminals.settings")}</h2>
      <TerminalEditor terminal={selected} currencies={currencies} mode={mode} />
    </section>
  </section>;
  const addressesCompact = Boolean(addressStatus && addressStatus.counts.never_issued + addressStatus.counts.eligible_for_reuse > 0 && addressStatus.counts.needs_review === 0 && addressStatus.snapshot?.outcome !== "failed");
  const cell = "block py-1 before:mr-2 before:text-xs before:font-semibold before:uppercase before:tracking-[0.06em] before:text-ink-soft before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-3 sm:align-middle sm:before:content-none";
  return <section className="grid min-w-0 gap-6">
    <div className="min-w-0 max-w-2xl">
      <h1 className="font-sans text-2xl font-semibold sm:text-3xl">{t("terminals.title")}</h1>
      <p className="mt-2 text-ink-soft">{t("terminals.intro")}</p>
    </div>
    {demoNote}
    {selectedId ? <p role="status" className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm">{t("terminals.notFound")}</p> : null}

    <details className="rounded-2xl open:border open:border-stroke open:p-5">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-full bg-ink px-5 py-2 font-semibold text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">{t("terminals.create")}</summary>
      <div className="mt-5"><TerminalEditor currencies={currencies} mode={mode} /></div>
    </details>

    <section aria-labelledby="terminals-list-title" className="grid min-w-0 gap-3">
      <h2 id="terminals-list-title" className="font-sans text-xl font-semibold">{t("terminals.yourTerminals")}</h2>
      {terminals.length === 0 ? <p>{t("terminals.none")}</p> : <table className="block w-full min-w-0 text-left sm:table">
        <thead className="sr-only sm:not-sr-only sm:table-header-group">
          <tr className="border-b border-stroke text-xs uppercase tracking-[0.06em] text-ink-soft">
            <th scope="col" className="sm:px-3 sm:py-2">{t("terminals.colName")}</th>
            <th scope="col" className="sm:px-3 sm:py-2">{t("terminals.colSettings")}</th>
            <th scope="col" className="sm:px-3 sm:py-2">{t("terminals.colStatus")}</th>
            <th scope="col" className="sm:px-3 sm:py-2">{t("terminals.colLastUsed")}</th>
            <th scope="col" className="sm:px-3 sm:py-2"><span className="sr-only">{t("terminals.colActions")}</span></th>
          </tr>
        </thead>
        <tbody className="grid gap-3 sm:table-row-group">
          {terminals.map(terminal => <tr key={terminal.id} className="block rounded-2xl border border-stroke p-4 sm:table-row sm:rounded-none sm:border-0 sm:border-b sm:p-0">
            <th scope="row" className="block break-words py-1 text-left font-semibold sm:table-cell sm:px-3 sm:py-3 sm:align-middle">
              <Link className={linkClass} href={detailHref(mode, terminal.id)}>{terminal.name}</Link>
            </th>
            <td data-label={t("terminals.colSettings")} className={cell}>{summary(terminal, t)}</td>
            <td data-label={t("terminals.colStatus")} className={`${cell} whitespace-nowrap`}>{statusBadge(terminal, t)}</td>
            <td data-label={t("terminals.colLastUsed")} className={`${cell} text-sm`}>{lastUsed(terminal, t)}</td>
            <td className="block whitespace-nowrap pt-2 sm:table-cell sm:px-3 sm:py-3 sm:text-right sm:align-middle">
              <Link className="inline-flex min-h-11 items-center rounded-full border border-stroke px-4 py-2 text-sm font-semibold transition hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50" href={detailHref(mode, terminal.id)} aria-label={t("terminals.manageLabel", { name: terminal.name })}>{t("terminals.manage")}</Link>
            </td>
          </tr>)}
        </tbody>
      </table>}
    </section>

    {tour ? null : <InvoiceAddressAvailability status={addressStatus} showRefresh={false} compact={addressesCompact} />}

    <details className="text-sm text-ink-soft">
      <summary className="inline-flex min-h-11 cursor-pointer items-center py-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50">{t("terminals.aboutAddresses")}</summary>
      <div className="mt-1 grid gap-2">
        <p>{t("terminals.addressNote")}</p>
        <p><Link className={linkClass} href="/guides/in-person-monero-checkout">{t("terminals.guide")}</Link></p>
      </div>
    </details>
  </section>;
}
