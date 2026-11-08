import Link from "next/link";

import { getI18n } from "../lib/i18n/server";
import { utcTimestamp } from "../lib/timestamps";

type Channel = { enabled: boolean; last_used_at?: string | null };

type SalesChannelCardsProps = {
  // null means the list could not be retrieved.
  paymentLinks: Channel[] | null;
  terminals: Channel[] | null;
  allowance: { remaining: number; daily_limit: number } | null;
  mode?: "live" | "tour";
};

const cardClass =
  "rounded-surface border border-stroke bg-white/70 p-5 shadow-soft transition hover:border-ink/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50";

// Overview cards that keep payment links and terminals in view after the first invoice.
export default async function SalesChannelCards({ paymentLinks, terminals, allowance, mode = "live" }: SalesChannelCardsProps) {
  const { t } = await getI18n();
  const base = mode === "tour" ? "/tour" : "/dashboard";
  const enabledSummary = (items: Channel[]) =>
    t("dashboard.page.enabledOf", { enabled: items.filter((item) => item.enabled).length, count: items.length });
  const lastUsed = (terminals ?? [])
    .map((terminal) => terminal.last_used_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();

  const card = (href: string, label: string, headline: string, detail: string) => (
    <Link className={cardClass} href={href}>
      <p className="text-sm font-semibold text-ink-soft">{label}</p>
      <p className="mt-2 font-sans text-xl font-semibold">{headline}</p>
      <p className="mt-2 text-sm text-ink-soft">{detail}</p>
    </Link>
  );

  return (
    <>
      {card(
        `${base}?tab=payment-links`,
        t("dashboard.page.navPaymentLinks"),
        paymentLinks === null
          ? t("health.unavailable")
          : paymentLinks.length === 0
            ? t("dashboard.page.linksNone")
            : enabledSummary(paymentLinks),
        paymentLinks !== null && paymentLinks.length > 0 && allowance
          ? t("dashboard.page.linksAllowance", { remaining: allowance.remaining, limit: allowance.daily_limit })
          : t("dashboard.page.linksHelp"),
      )}
      {card(
        `${base}?tab=terminals`,
        t("dashboard.page.navTerminals"),
        terminals === null
          ? t("health.unavailable")
          : terminals.length === 0
            ? t("dashboard.page.terminalsNone")
            : enabledSummary(terminals),
        terminals !== null && terminals.length > 0
          ? t("terminals.lastUsed", { time: lastUsed ? utcTimestamp(lastUsed, t) : t("terminals.never") })
          : t("dashboard.page.terminalsHelp"),
      )}
    </>
  );
}
