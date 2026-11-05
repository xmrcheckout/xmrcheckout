import Link from "next/link";

import { getI18n } from "../lib/i18n/server";
import type { Translate } from "../lib/i18n/translate";
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

const healthBadge = (status: SystemStatusSummary | null, t: Translate) => {
  if (!status || status.reconciler === "unavailable") {
    return { label: t("health.unavailable"), tone: "pending" as StatusTone };
  }
  if (status.reconciler === "degraded") {
    return { label: t("health.needsReview"), tone: "error" as StatusTone };
  }
  return { label: t("health.operational"), tone: "success" as StatusTone };
};

const connectionBadge = (
  value: "ok" | "unreachable" | "unknown" | undefined,
  t: Translate,
) => {
  if (value === "ok") {
    return { label: t("health.connected"), tone: "success" as StatusTone };
  }
  if (value === "unknown") {
    return { label: t("health.notConfigured"), tone: "neutral" as StatusTone };
  }
  return { label: value ? t("health.unavailable") : t("health.unknown"), tone: "error" as StatusTone };
};

const displayRelativeTime = (value: string | null | undefined, locale: string, t: Translate) =>
  formatRelativeTime(value, locale) ?? t("time.notRecorded");

export default async function SystemHealthPanel({ status }: SystemHealthPanelProps) {
  const { locale, t } = await getI18n();
  const overall = healthBadge(status, t);
  const wallet = connectionBadge(status?.wallet_rpc, t);
  const daemon = connectionBadge(status?.daemon, t);
  const completedAt = displayRelativeTime(status?.last_reconcile_completed_at, locale, t);
  const attempted = status?.last_reconcile_attempted_invoices ?? 0;
  const succeeded = status?.last_reconcile_succeeded_invoices ?? 0;
  const failed = status?.last_reconcile_failed_invoices ?? 0;

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6" aria-labelledby="system-health-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stroke pb-6">
        <div className="max-w-2xl">
          <h1
            className="font-sans text-3xl font-semibold leading-tight"
            id="system-health-title"
          >
            {t("health.title")}
          </h1>
          <p className="mt-2 text-ink-soft">
            {t("health.intro")}
          </p>
        </div>
        <StatusRefreshButton label={t("health.refresh")} />
      </header>

      <section
        className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6"
        aria-labelledby="health-summary-title"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-soft">{t("health.detectionStatus")}</p>
            <h2
              className="mt-1 font-sans text-2xl font-semibold"
              id="health-summary-title"
            >
              {overall.label}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-soft">
              {status?.reconciler === "ok"
                ? t("health.cycleOk")
                : status?.reconciler === "degraded"
                  ? t("health.cycleDegraded")
                  : t("health.cycleNone")}
            </p>
          </div>
          <StatusBadge label={overall.label} tone={overall.tone} />
        </div>

        <dl className="mt-6 grid gap-3 border-t border-stroke pt-5 sm:grid-cols-3">
          {[
            { label: t("health.walletRpc"), value: wallet.label, tone: wallet.tone },
            { label: t("health.daemon"), value: daemon.label, tone: daemon.tone },
            {
              label: t("health.reconciler"),
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
              {t("health.details")}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {t("health.detailsIntro")}
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-ink underline underline-offset-4"
            href="/docs#concepts"
          >
            {t("health.docs")}
          </Link>
        </div>
        <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: t("health.daemonHeight"),
              value: status?.daemon_height?.toLocaleString(locale) ?? t("health.unavailable"),
            },
            {
              label: t("health.interval"),
              value: `${status?.invoice_reconcile_interval_seconds ?? 30}s`,
            },
            { label: t("health.lastCheck"), value: completedAt },
            {
              label: t("health.latestChecks"),
              value: status ? t("health.checksSuccessful", { succeeded, attempted }) : t("health.unavailable"),
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
              ? t("health.failedChecks", { count: failed })
              : t("health.noFailures")}
          </p>
          <p className="text-sm text-ink-soft lg:border-l lg:border-stroke lg:pl-5">
            {t("health.zeroConfHint")}
          </p>
        </div>
        {status?.last_reconcile_error ? (
          <p className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">
            {t("health.lastError", { error: status.last_reconcile_error })}
          </p>
        ) : null}
      </section>
    </section>
  );
}
