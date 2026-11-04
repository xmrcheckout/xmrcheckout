import Link from "next/link";
import { utcTimestamp } from "../lib/timestamps";
import { getI18n } from "../lib/i18n/server";
import type { Translate } from "../lib/i18n/translate";
import DiagnosticReference from "./diagnostic-reference";
import StatusRefreshButton from "./status-refresh-button";

type Category = "never_issued" | "eligible_for_reuse" | "reserved" | "cooling_down" | "needs_review";
export type SubaddressStatus = {
  retrieved_at: string;
  cooldown_seconds: number;
  pool_size: number;
  counts: Record<Category, number>;
  earliest_estimated_eligibility_at: string | null;
  addresses: {
    index: number;
    category: Category;
    code: string;
    latest_closure_at: string | null;
    cooldown_complete_at: string | null;
    invoice_ids: string[];
  }[];
  snapshot: {
    attempt_id: string;
    attempted_at: string;
    completed_at: string | null;
    outcome: "running" | "succeeded" | "failed";
    duration_ms: number | null;
    failure_category: string | null;
    last_success_at: string | null;
  } | null;
};

const timestamp = (value: string | null, t: Translate) => value ? utcTimestamp(value, t) : t("time.notRecorded");

const explanationCodes = new Set(["never_issued", "cooldown_complete", "active_invoice", "awaiting_invoice_status_update", "reuse_cooldown", "inconsistent_history", "invalid_prior_invoice", "missing_closure_time"]);

const failureCodes = new Set(["wallet_busy", "wallet_syncing", "wallet_unavailable", "daemon_unavailable", "incomplete_snapshot", "rpc_error", "snapshot_unavailable"]);

export default async function InvoiceAddressAvailability({ status, full = false, showRefresh = true, compact = false }: {
  status: SubaddressStatus | null;
  full?: boolean;
  compact?: boolean;
  showRefresh?: boolean;
}) {
  const { locale, t } = await getI18n();
  const snapshot = status?.snapshot;
  const eligible = status ? status.counts.never_issued + status.counts.eligible_for_reuse : null;
  if (compact) return (
    <section className="min-w-0 rounded-surface border border-stroke bg-white/70 p-4 shadow-soft" aria-label={t("addresses.title")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-sm font-semibold">{t("addresses.title")}</h2>
          {eligible !== null ? <p className="mt-1 text-sm"><span>{t("addresses.eligible")}</span> <strong className="ml-2 font-mono text-lg">{eligible}</strong></p> : null}
        </div>
        {showRefresh ? <StatusRefreshButton label={t("addresses.refresh")} /> : null}
      </div>
      {!status ? <p className="mt-2 text-sm" role="status">{t("addresses.unavailable")}</p> : <>
        {eligible === 0 ? <p className="mt-2 text-sm font-semibold" role="status">{t("addresses.noneEligible")}</p> : null}
        {status.counts.needs_review > 0 ? <p className="mt-2 text-sm font-semibold" role="status">{t("addresses.needsReviewCount", { count: status.counts.needs_review })}</p> : null}
        <p className="mt-2 text-xs text-ink-soft">{t("refresh.retrieved")} <time dateTime={status.retrieved_at}>{timestamp(status.retrieved_at, t)}</time></p>
      </>}
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-clay">{t("addresses.detailsSummary")}</summary>
        {status ? <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          {[[t("addresses.reserved"), status.counts.reserved], [t("addresses.waiting"), status.counts.cooling_down], [t("addresses.needsReview"), status.counts.needs_review]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}
        </dl> : null}
        <p className="mt-2 text-sm text-ink-soft">{t("addresses.waitNote")}</p>
        <p className="mt-2 text-sm text-ink-soft">{t("addresses.noGuarantee")}</p>
        <Link className="mt-2 inline-block min-h-11 py-3 text-sm font-semibold underline underline-offset-4" href="/dashboard?tab=health">{t("addresses.viewInHealth")}</Link>
      </details>
    </section>
  );
  return (
    <section className="min-w-0 rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6" aria-label={t("addresses.title")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-sans text-xl font-semibold">{t("addresses.title")}</h2>
        {showRefresh ? <StatusRefreshButton label={t("addresses.refresh")} /> : null}
      </div>
      {status ? (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 xl:grid-cols-4">
            {[
              [t("addresses.eligible"), status.counts.never_issued + status.counts.eligible_for_reuse],
              [t("addresses.reserved"), status.counts.reserved],
              [t("addresses.waiting"), status.counts.cooling_down],
              [t("addresses.needsReview"), status.counts.needs_review],
            ].map(([label, value]) => (
              <div key={label}><dt className="text-sm text-ink-soft">{label}</dt><dd className="mt-1 font-mono text-2xl font-semibold">{value}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-ink-soft">{t("refresh.retrieved")} <time dateTime={status.retrieved_at}>{timestamp(status.retrieved_at, t)}</time></p>
        </>
      ) : <p className="mt-4" role="status">{t("addresses.unavailable")}</p>}
      <p className="mt-2 text-sm text-ink-soft">{t("addresses.noGuarantee")}</p>
      {!full ? <Link className="mt-3 inline-block min-h-11 py-2 text-sm font-semibold underline underline-offset-4" href="/dashboard?tab=health">{t("addresses.viewInHealth")}</Link> : status ? (
        <>
          <p className="mt-3 text-sm">{t("addresses.poolSummary", { pool: status.pool_size, seconds: status.cooldown_seconds.toLocaleString(locale) })}</p>
          {status.earliest_estimated_eligibility_at ? <p className="mt-2 text-sm">{t("addresses.earliest", { time: timestamp(status.earliest_estimated_eligibility_at, t) })}</p> : null}
          <div className="mt-5 border-t border-stroke pt-4">
            <h3 className="font-semibold">{t("addresses.latestSnapshot")}</h3>
            {snapshot ? (
              <div className="mt-2 grid min-w-0 gap-2 text-sm">
                <p>{t("addresses.latestAttempt", { time: timestamp(snapshot.attempted_at, t), outcome: snapshot.outcome === "succeeded" ? t("addresses.successful") : snapshot.outcome === "failed" ? t("addresses.failed") : t("addresses.inProgress") })}</p>
                <p>{t("addresses.completed", { time: timestamp(snapshot.completed_at, t) })}{snapshot.duration_ms !== null ? ` (${snapshot.duration_ms} ms)` : ""}</p>
                <p>{t("addresses.lastSuccess", { time: timestamp(snapshot.last_success_at, t) })}</p>
                {snapshot.outcome === "failed" ? <p className="text-red-700">{t(`addresses.failure.${failureCodes.has(snapshot.failure_category ?? "") ? snapshot.failure_category : "snapshot_unavailable"}`)} {t("addresses.noReuseOnFailure")}</p> : null}
                <DiagnosticReference value={snapshot.attempt_id} />
              </div>
            ) : <p className="mt-2 text-sm">{t("addresses.noSnapshot")}</p>}
            <p className="mt-2 text-sm text-ink-soft">{t("addresses.snapshotNote")}</p>
          </div>
          <details className="mt-5 border-t border-stroke pt-3">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay">{t("addresses.addressDetails", { count: status.pool_size })}</summary>
            <ul className="divide-y divide-stroke">
              {status.addresses.map((address) => (
                <li key={address.index} className="min-w-0 py-3 text-sm">
                  <p className="font-semibold">{t("addresses.indexLine", { index: address.index, explanation: explanationCodes.has(address.code) ? t(`addresses.code.${address.code}`) : t("addresses.needsReview") })}</p>
                  {address.latest_closure_at ? <p>{t("addresses.latestClosure", { time: timestamp(address.latest_closure_at, t) })}</p> : null}
                  {address.cooldown_complete_at ? <p>{t("addresses.estimatedEligibility", { time: timestamp(address.cooldown_complete_at, t) })}</p> : null}
                  {address.code === "awaiting_invoice_status_update" ? <p>{t("addresses.pendingExpired")}</p> : null}
                  {address.invoice_ids.length ? <details className="mt-1"><summary className="min-h-11 cursor-pointer py-2 focus-visible:ring-2 focus-visible:ring-clay">{t("addresses.relatedInvoices", { count: address.invoice_ids.length })}</summary><ul className="grid gap-2">{address.invoice_ids.map((id) => <li className="break-all" key={id}><Link className="font-mono underline underline-offset-4" href={`/dashboard?tab=invoices&status=all&archived=1&q=${id}`}>{id}</Link></li>)}</ul></details> : null}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}
