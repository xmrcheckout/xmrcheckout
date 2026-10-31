import Link from "next/link";
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

const timestamp = (value: string | null) => value
  ? `${new Date(value).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`
  : "Not recorded";

const explanations: Record<string, string> = {
  never_issued: "Never issued",
  cooldown_complete: "Eligible for reuse",
  active_invoice: "Reserved by an active invoice",
  awaiting_invoice_status_update: "Awaiting invoice status update",
  reuse_cooldown: "Reuse cooldown in progress",
  inconsistent_history: "Allocation history needs review",
  invalid_prior_invoice: "Prior invoice needs review",
  missing_closure_time: "Closure time is missing",
};

const failures: Record<string, string> = {
  wallet_busy: "The view-only wallet was busy. Try again shortly.",
  wallet_syncing: "The view-only wallet is still syncing.",
  wallet_unavailable: "The view-only wallet could not be reached.",
  daemon_unavailable: "Blockchain height could not be verified.",
  incomplete_snapshot: "The wallet returned incomplete observation data.",
  rpc_error: "The wallet could not complete the snapshot request.",
  snapshot_unavailable: "A safe view-only snapshot could not be completed.",
};

export default function InvoiceAddressAvailability({ status, full = false, showRefresh = true, compact = false }: {
  status: SubaddressStatus | null;
  full?: boolean;
  compact?: boolean;
  showRefresh?: boolean;
}) {
  const snapshot = status?.snapshot;
  const eligible = status ? status.counts.never_issued + status.counts.eligible_for_reuse : null;
  if (compact) return (
    <section className="min-w-0 rounded-surface border border-stroke bg-white/70 p-4 shadow-soft" aria-label="Invoice address availability">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-sm font-semibold">Invoice address availability</h2>
          {eligible !== null ? <p className="mt-1 text-sm">Eligible addresses <strong className="ml-2 font-mono text-lg">{eligible}</strong></p> : null}
        </div>
        {showRefresh ? <StatusRefreshButton label="Refresh availability" /> : null}
      </div>
      {!status ? <p className="mt-2 text-sm" role="status">Unavailable. Refresh to try again.</p> : <>
        {eligible === 0 ? <p className="mt-2 text-sm font-semibold" role="status">No invoice addresses are currently eligible.</p> : null}
        {status.counts.needs_review > 0 ? <p className="mt-2 text-sm font-semibold" role="status">Needs review: {status.counts.needs_review}. Check System health for details.</p> : null}
        <p className="mt-2 text-xs text-ink-soft">Status retrieved: <time dateTime={status.retrieved_at}>{timestamp(status.retrieved_at)}</time></p>
      </>}
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-clay">Address availability details</summary>
        {status ? <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          {[["Reserved addresses", status.counts.reserved], ["Cooling-down addresses", status.counts.cooling_down], ["Needs review", status.counts.needs_review]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}
        </dl> : null}
        <p className="mt-2 text-sm text-ink-soft">Address eligibility does not guarantee invoice creation. Pending invoices, wallet availability, and creation limits still apply.</p>
        <Link className="mt-2 inline-block min-h-11 py-3 text-sm font-semibold underline underline-offset-4" href="/dashboard?tab=health">View address and snapshot details in System health</Link>
      </details>
    </section>
  );
  return (
    <section className="min-w-0 rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6" aria-label="Invoice address availability">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-sans text-xl font-semibold">Invoice address availability</h2>
        {showRefresh ? <StatusRefreshButton label="Refresh availability" /> : null}
      </div>
      {status ? (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 xl:grid-cols-4">
            {[
              ["Eligible addresses", status.counts.never_issued + status.counts.eligible_for_reuse],
              ["Reserved addresses", status.counts.reserved],
              ["Cooling-down addresses", status.counts.cooling_down],
              ["Needs review", status.counts.needs_review],
            ].map(([label, value]) => (
              <div key={label}><dt className="text-sm text-ink-soft">{label}</dt><dd className="mt-1 font-mono text-2xl font-semibold">{value}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-ink-soft">Status retrieved: <time dateTime={status.retrieved_at}>{timestamp(status.retrieved_at)}</time></p>
        </>
      ) : <p className="mt-4" role="status">Unavailable. Refresh to try again.</p>}
      <p className="mt-2 text-sm text-ink-soft">Address eligibility does not guarantee invoice creation. Pending invoices, wallet availability, and creation limits still apply.</p>
      {!full ? <Link className="mt-3 inline-block min-h-11 py-2 text-sm font-semibold underline underline-offset-4" href="/dashboard?tab=health">View address and snapshot details in System health</Link> : status ? (
        <>
          <p className="mt-3 text-sm">Supported pool: {status.pool_size}. Reuse cooldown: {status.cooldown_seconds.toLocaleString("en-GB")} seconds.</p>
          {status.earliest_estimated_eligibility_at ? <p className="mt-2 text-sm">Earliest estimated eligibility: {timestamp(status.earliest_estimated_eligibility_at)}. This is an estimate, not a creation guarantee.</p> : null}
          <div className="mt-5 border-t border-stroke pt-4">
            <h3 className="font-semibold">Latest view-only snapshot</h3>
            {snapshot ? (
              <div className="mt-2 grid min-w-0 gap-2 text-sm">
                <p>Latest attempt: {timestamp(snapshot.attempted_at)} — {snapshot.outcome === "succeeded" ? "Successful" : snapshot.outcome === "failed" ? "Failed" : "In progress"}</p>
                <p>Completed: {timestamp(snapshot.completed_at)}{snapshot.duration_ms !== null ? ` (${snapshot.duration_ms} ms)` : ""}</p>
                <p>Last successful snapshot: {timestamp(snapshot.last_success_at)}</p>
                {snapshot.outcome === "failed" ? <p className="text-red-700">{failures[snapshot.failure_category ?? ""] ?? failures.snapshot_unavailable} No address was reused by this failed attempt.</p> : null}
                <DiagnosticReference value={snapshot.attempt_id} />
              </div>
            ) : <p className="mt-2 text-sm">No snapshot attempt recorded.</p>}
            <p className="mt-2 text-sm text-ink-soft">Snapshots check existing observations before address reuse. Newly issued addresses do not need a reuse snapshot.</p>
          </div>
          <details className="mt-5 border-t border-stroke pt-3">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay">Address details ({status.pool_size})</summary>
            <ul className="divide-y divide-stroke">
              {status.addresses.map((address) => (
                <li key={address.index} className="min-w-0 py-3 text-sm">
                  <p className="font-semibold">Index {address.index}: {explanations[address.code] ?? "Needs review"}</p>
                  {address.latest_closure_at ? <p>Latest closure: {timestamp(address.latest_closure_at)}</p> : null}
                  {address.cooldown_complete_at ? <p>Estimated eligibility: {timestamp(address.cooldown_complete_at)}</p> : null}
                  {address.code === "awaiting_invoice_status_update" ? <p>The pending invoice has passed its expiry. Its address stays reserved until its status updates.</p> : null}
                  {address.invoice_ids.length ? <details className="mt-1"><summary className="min-h-11 cursor-pointer py-2 focus-visible:ring-2 focus-visible:ring-clay">Related invoices ({address.invoice_ids.length})</summary><ul className="grid gap-2">{address.invoice_ids.map((id) => <li className="break-all" key={id}><Link className="font-mono underline underline-offset-4" href={`/dashboard?tab=invoices&status=all&archived=1&q=${id}`}>{id}</Link></li>)}</ul></details> : null}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}
