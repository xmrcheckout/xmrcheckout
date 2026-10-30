import Link from "next/link";

import { formatRelativeTime } from "./relative-time";
import StatusBadge, { type StatusTone } from "./status-badge";
import StatusRefreshButton from "./status-refresh-button";

export type SystemStatusSummary = {
  wallet_rpc: "ok" | "unreachable";
  daemon: "ok" | "unreachable" | "unknown";
  reconciler: "ok" | "degraded" | "unavailable";
  daemon_height: number | null;
  invoice_reconcile_interval_seconds: number;
  last_reconcile_started_at: string | null;
  last_reconcile_completed_at: string | null;
  last_reconcile_error: string | null;
  last_reconcile_attempted_invoices: number;
  last_reconcile_succeeded_invoices: number;
  last_reconcile_failed_invoices: number;
};

type SystemHealthPanelProps = {
  status: SystemStatusSummary | null;
};

const healthBadge = (status: SystemStatusSummary | null) => {
  if (!status || status.reconciler === "unavailable") {
    return { label: "Unavailable", tone: "pending" as StatusTone };
  }
  if (status.reconciler === "degraded") {
    return { label: "Needs review", tone: "error" as StatusTone };
  }
  return { label: "Operational", tone: "success" as StatusTone };
};

const connectionBadge = (
  value: "ok" | "unreachable" | "unknown" | undefined,
) => {
  if (value === "ok") {
    return { label: "Connected", tone: "success" as StatusTone };
  }
  if (value === "unknown") {
    return { label: "Not configured", tone: "neutral" as StatusTone };
  }
  return { label: value ? "Unavailable" : "Unknown", tone: "error" as StatusTone };
};

const displayRelativeTime = (value: string | null | undefined) =>
  formatRelativeTime(value) ?? "Not recorded";

export default function SystemHealthPanel({ status }: SystemHealthPanelProps) {
  const overall = healthBadge(status);
  const wallet = connectionBadge(status?.wallet_rpc);
  const daemon = connectionBadge(status?.daemon);
  const completedAt = displayRelativeTime(status?.last_reconcile_completed_at);
  const attempted = status?.last_reconcile_attempted_invoices ?? 0;
  const succeeded = status?.last_reconcile_succeeded_invoices ?? 0;
  const failed = status?.last_reconcile_failed_invoices ?? 0;

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6" aria-labelledby="system-health-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stroke pb-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
            System health
          </p>
          <h1
            className="mt-1 font-sans text-3xl font-semibold leading-tight"
            id="system-health-title"
          >
            Is payment detection keeping up?
          </h1>
          <p className="mt-2 text-ink-soft">
            A focused view of services that observe payments and relay invoice
            events.
          </p>
        </div>
        <StatusRefreshButton label="Refresh health" />
      </header>

      <section
        className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6"
        aria-labelledby="health-summary-title"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-soft">Detection status</p>
            <h2
              className="mt-1 font-sans text-2xl font-semibold"
              id="health-summary-title"
            >
              {overall.label}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-soft">
              {status?.reconciler === "ok"
                ? "The latest detection cycle completed successfully."
                : status?.reconciler === "degraded"
                  ? "Some invoice checks or service connections need attention."
                  : "The service has not reported a usable detection cycle yet."}
            </p>
          </div>
          <StatusBadge label={overall.label} tone={overall.tone} />
        </div>

        <dl className="mt-6 grid gap-3 border-t border-stroke pt-5 sm:grid-cols-3">
          {[
            { label: "Wallet RPC", value: wallet.label, tone: wallet.tone },
            { label: "Daemon", value: daemon.label, tone: daemon.tone },
            {
              label: "Reconciler",
              value: overall.label,
              tone: overall.tone,
            },
          ].map((item) => (
            <div
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-stroke bg-cream/60 px-4 py-3 sm:block"
              key={item.label}
            >
              <dt className="text-sm font-semibold text-ink-soft">{item.label}</dt>
              <dd className="mt-1">
                <StatusBadge label={item.value} tone={item.tone} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="rounded-surface border border-stroke bg-white/70 shadow-soft"
        aria-labelledby="health-details-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stroke px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-sans text-xl font-semibold" id="health-details-title">
              Detection details
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              The signals an operator can use to explain a delayed invoice.
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-ink underline underline-offset-4"
            href="/docs#concepts"
          >
            Read operations docs
          </Link>
        </div>
        <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Daemon height",
              value: status?.daemon_height?.toLocaleString() ?? "Unavailable",
            },
            {
              label: "Detection interval",
              value: `${status?.invoice_reconcile_interval_seconds ?? 30}s`,
            },
            { label: "Last successful check", value: completedAt },
            {
              label: "Latest invoice checks",
              value: status ? `${succeeded}/${attempted} successful` : "Unavailable",
            },
          ].map((item) => (
            <div
              className="border-t border-stroke px-5 py-4 first:border-t-0 sm:[&:nth-child(2)]:border-t-0 xl:border-t-0 xl:[&:nth-child(3)]:border-t"
              key={item.label}
            >
              <dt className="text-xs font-semibold text-ink-soft">{item.label}</dt>
              <dd className="mt-1 break-words font-mono text-sm font-semibold text-ink">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-3 border-t border-stroke px-5 py-4 sm:px-6 lg:grid-cols-2">
          <p className="text-sm text-ink-soft">
            {failed > 0
              ? `${failed} invoice check${failed === 1 ? "" : "s"} failed in the latest cycle.`
              : "No invoice checks failed in the latest cycle."}
          </p>
          <p className="text-sm text-ink-soft lg:border-l lg:border-stroke lg:pl-5">
            If a payment remains at zero confirmations, compare this page with
            the daemon height and the public invoice status.
          </p>
        </div>
        {status?.last_reconcile_error ? (
          <p className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">
            Last detection error: {status.last_reconcile_error}
          </p>
        ) : null}
      </section>
    </section>
  );
}
