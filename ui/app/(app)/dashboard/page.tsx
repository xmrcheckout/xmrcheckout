import type { Metadata } from "next";
import { invoiceContext } from "../../../lib/invoice-display";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dashboardDestination } from "../../../lib/wallet-connection";
import { getI18n } from "../../../lib/i18n/server";
import {
  invoiceStatusLabel,
  invoiceStatuses,
  invoiceStatusTones,
  type InvoiceStatus,
} from "../../../lib/invoice-status";

import ApiKeySection from "../../../components/api-key-section";
import BtcpayCheckoutStyleSection from "../../../components/btcpay-checkout-style-section";
import DefaultConfirmationTargetSection from "../../../components/default-confirmation-target-section";
import DefaultQrLogoSection from "../../../components/default-qr-logo-section";
import InvoiceAddressAvailability, { type SubaddressStatus } from "../../../components/invoice-address-availability";
import InvoicePanel from "../../../components/invoice-panel";
import StatusBadge, { type StatusTone } from "../../../components/status-badge";
import SystemHealthPanel, {
  type SystemStatusSummary,
} from "../../../components/system-health-panel";
import WebhookHistoryPanel from "../../../components/webhook-history-panel";
import WebhookSecretSection from "../../../components/webhook-secret-section";
import WebhookSection from "../../../components/webhook-section";
import PaymentLinks from "../../../components/payment-links";
import Terminals from "../../../components/terminals";
import WorkspaceNav from "../../../components/workspace-nav";
import type { Translate } from "../../../lib/i18n/translate";
import { rich } from "../../../lib/i18n/rich";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("nav.dashboard") };
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";
const tabs = ["overview", "invoices", "payment-links", "terminals", "webhooks", "profile", "health"] as const;
const webhookTabs = ["settings", "history"] as const;
type DashboardTab = (typeof tabs)[number];
type WebhookTab = (typeof webhookTabs)[number];
type InvoiceStatusFilter = InvoiceStatus | "active" | "all";

type DashboardSearchParams = Record<string, string | string[] | undefined>;
type InvoiceSummary = {
  metadata?: Record<string, unknown> | null;
  id: string;
  address: string;
  subaddress_index?: number | null;
  amount_xmr: string;
  amount_paid_xmr?: string | null;
  amount_remaining_xmr?: string | null;
  status: InvoiceStatus;
  confirmation_target: number;
  confirmations?: number | null;
  paid_after_expiry?: boolean;
  paid_after_expiry_at?: string | null;
  created_at: string;
  archived_at: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
  expires_at: string | null;
};
type WebhookSummary = {
  id: string;
  url: string;
  events: string[];
  event_urls?: Record<string, string> | null;
  active: boolean;
  created_at: string;
};
type WebhookDeliverySummary = {
  id: string;
  webhook_id: string | null;
  event: string;
  url: string;
  invoice_id: string | null;
  invoice_address: string | null;
  invoice_subaddress_index: number | null;
  invoice_amount_xmr: string | null;
  invoice_status: InvoiceStatus | null;
  http_status: number | null;
  error_message: string | null;
  attempt?: number;
  next_attempt_at?: string | null;
  created_at: string;
};
type ProfileSummary = {
  id: string;
  payment_address: string;
  default_confirmation_target: number;
  default_qr_logo: "monero" | "none" | "custom";
  default_qr_logo_data_url: string | null;
  btcpay_checkout_style?: "standard" | "btcpay_classic";
  created_at: string;
};

const dashboardNavItems = (t: Translate) => [
  { value: "payment-links", href: "/dashboard?tab=payment-links", label: t("dashboard.page.navPaymentLinks"), detail: t("dashboard.page.navPaymentLinksDetail") },
  { value: "terminals", href: "/dashboard?tab=terminals", label: t("dashboard.page.navTerminals"), detail: t("dashboard.page.navTerminalsDetail") },
  {
    value: "overview",
    href: "/dashboard?tab=overview",
    label: t("dashboard.page.navOverview"),
    detail: t("dashboard.page.navOverviewDetail"),
  },
  {
    value: "invoices",
    href: "/dashboard?tab=invoices",
    label: t("dashboard.page.navInvoices"),
    detail: t("dashboard.page.navInvoicesDetail"),
  },
  {
    value: "webhooks",
    href: "/dashboard?tab=webhooks",
    label: t("dashboard.page.navWebhooks"),
    detail: t("dashboard.page.navWebhooksDetail"),
  },
  {
    value: "profile",
    href: "/dashboard?tab=profile",
    label: t("dashboard.page.navProfile"),
    detail: t("dashboard.page.navProfileDetail"),
  },
  {
    value: "health",
    href: "/dashboard?tab=health",
    label: t("dashboard.page.navHealth"),
    detail: t("dashboard.page.navHealthDetail"),
  },
];

const reconcilerBadge = (systemStatus: SystemStatusSummary | null, t: Translate) => {
  if (!systemStatus || systemStatus.reconciler === "unavailable") {
    return { tone: "pending" as StatusTone, label: t("dashboard.page.reconcilerUnavailable") };
  }
  if (systemStatus.reconciler === "ok") {
    return { tone: "success" as StatusTone, label: t("dashboard.page.healthy") };
  }
  return { tone: "error" as StatusTone, label: t("dashboard.page.degraded") };
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { locale, t } = await getI18n();
  const destinationParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") destinationParams.set(key, value);
  }
  const loginUrl = `/?login=1&next=${encodeURIComponent(dashboardDestination(`/dashboard?${destinationParams}`))}`;
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  const webhookSecret =
    (await cookies()).get("xmrcheckout_webhook_secret")?.value ?? null;
  if (!apiKey) {
    redirect(loginUrl);
  }

  const tabParam = resolvedSearchParams?.tab;
  const activeTabValue = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const activeTab: DashboardTab = tabs.includes(activeTabValue as DashboardTab)
    ? (activeTabValue as DashboardTab)
    : "overview";
  const webhookTabParam = resolvedSearchParams?.webhook_tab;
  const activeWebhookTabValue = Array.isArray(webhookTabParam)
    ? webhookTabParam[0]
    : webhookTabParam;
  const activeWebhookTab: WebhookTab = webhookTabs.includes(
    activeWebhookTabValue as WebhookTab,
  )
    ? (activeWebhookTabValue as WebhookTab)
    : "settings";
  const includeArchived =
    activeTab === "invoices" &&
    (resolvedSearchParams?.archived === "1" ||
      resolvedSearchParams?.archived === "true");
  const qParam = resolvedSearchParams?.q;
  const queryValue = Array.isArray(qParam) ? qParam[0] : qParam;
  const invoiceSearchQuery = activeTab === "invoices" ? (queryValue ?? "") : "";
  const statusParam = resolvedSearchParams?.status;
  const statusValue = Array.isArray(statusParam) ? statusParam[0] : statusParam;
  const invoiceStatusFilter: InvoiceStatusFilter =
    activeTab !== "invoices"
      ? "all"
      : statusValue === "all"
        ? "all"
        : statusValue === "active" ||
            invoiceStatuses.includes(statusValue as InvoiceStatus)
          ? (statusValue as InvoiceStatusFilter)
          : includeArchived
            ? "all"
            : "active";
  const pageParam = resolvedSearchParams?.page;
  const pageValue = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const invoicePage =
    activeTab === "invoices" && pageValue && /^\d+$/.test(pageValue)
      ? Math.max(1, Number.parseInt(pageValue, 10))
      : 1;
  const sortParam = resolvedSearchParams?.sort;
  const sortValue = Array.isArray(sortParam) ? sortParam[0] : sortParam;
  const invoiceSort =
    activeTab === "invoices" && typeof sortValue === "string" && sortValue
      ? sortValue
      : "created_at";
  const orderParam = resolvedSearchParams?.order;
  const orderValue = Array.isArray(orderParam) ? orderParam[0] : orderParam;
  const invoiceOrder =
    activeTab === "invoices" && typeof orderValue === "string" && orderValue
      ? orderValue
      : "desc";

  // API key is already available from the cookie
  const apiKeyData = activeTab === "profile" ? { api_key: apiKey } : null;
  let webhooksData: WebhookSummary[] = [];
  let webhookHistory: WebhookDeliverySummary[] = [];

  const invoicePageSize = 25;
  const invoiceLimit = activeTab === "invoices" ? invoicePageSize : 100;
  let invoicesData: { items: InvoiceSummary[]; total: number } | null = null;
  let offset = activeTab === "invoices" ? (invoicePage - 1) * invoiceLimit : 0;
  let total = 0;
  const items: InvoiceSummary[] = [];
  if (activeTab !== "payment-links" && activeTab !== "terminals") do {
    const invoiceUrl = new URL(`${apiBaseUrl}/api/core/invoices`);
    invoiceUrl.searchParams.set("limit", invoiceLimit.toString());
    invoiceUrl.searchParams.set("offset", offset.toString());
    if (includeArchived) {
      invoiceUrl.searchParams.set("include_archived", "true");
    }
    if (invoiceSearchQuery) {
      invoiceUrl.searchParams.set("q", invoiceSearchQuery);
    }
    if (invoiceStatusFilter === "active") {
      invoiceUrl.searchParams.set("active_only", "true");
    } else if (invoiceStatusFilter !== "all") {
      invoiceUrl.searchParams.set("status", invoiceStatusFilter);
    }
    if (invoiceSort) {
      invoiceUrl.searchParams.set("sort", invoiceSort);
    }
    if (invoiceOrder) {
      invoiceUrl.searchParams.set("order", invoiceOrder);
    }
    const response = await fetch(invoiceUrl.toString(), {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) {
      redirect(loginUrl);
    }
    if (!response.ok) {
      break;
    }
    const data = (await response.json()) as {
      items: InvoiceSummary[];
      total: number;
    };
    total = data.total;
    items.push(...data.items);
    offset += invoiceLimit;
  } while (activeTab !== "invoices" && offset < total);
  invoicesData = { items, total };

  if (activeTab === "webhooks" && activeWebhookTab === "settings") {
    const response = await fetch(`${apiBaseUrl}/api/core/webhooks`, {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) {
      redirect(loginUrl);
    }
    if (response.ok) {
      webhooksData = (await response.json()) as WebhookSummary[];
    }
  }
  if (
    activeTab === "overview" ||
    (activeTab === "webhooks" && activeWebhookTab === "history")
  ) {
    const historyUrl = new URL(`${apiBaseUrl}/api/core/webhooks/history`);
    historyUrl.searchParams.set("limit", "50");
    const response = await fetch(historyUrl.toString(), {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) {
      redirect(loginUrl);
    }
    if (response.ok) {
      webhookHistory = (await response.json()) as WebhookDeliverySummary[];
    }
  }

  let addressStatus: SubaddressStatus | null = null;
  if (["overview", "invoices", "health"].includes(activeTab)) {
    const response = await fetch(`${apiBaseUrl}/api/core/subaddresses/status`, {
      headers: { Authorization: `ApiKey ${apiKey}` },
      cache: "no-store",
    }).catch(() => null);
    if (response?.status === 401) redirect(loginUrl);
    if (response?.ok) addressStatus = await response.json().catch(() => null);
  }

  const allInvoices = invoicesData?.items ?? [];
  let profileData: ProfileSummary | null = null;
  let systemStatus: SystemStatusSummary | null = null;

  if (activeTab === "profile" || activeTab === "invoices") {
    const response = await fetch(`${apiBaseUrl}/api/core/profile`, {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) {
      redirect(loginUrl);
    }
    if (response.ok) {
      profileData = (await response.json()) as ProfileSummary;
    }
  }
  if (activeTab === "overview" || activeTab === "health") {
    // Scoped to this merchant: other merchants' failed checks never show here.
    const response = await fetch(`${apiBaseUrl}/api/core/system/status`, {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });
    if (response.ok) {
      systemStatus = (await response.json()) as SystemStatusSummary;
    }
  }

  const isToday = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const invoicesTodayCount = allInvoices.filter((invoice) =>
    isToday(invoice.created_at),
  ).length;
  const awaitingConfirmationCount = allInvoices.filter(
    (invoice) => invoice.status === "payment_detected",
  ).length;
  const partiallyPaidCount = allInvoices.filter(
    (invoice) => invoice.status === "partially_paid",
  ).length;
  const confirmedCount = allInvoices.filter(
    (invoice) => invoice.status === "confirmed",
  ).length;
  const failedWebhookCount = webhookHistory.filter(
    (delivery) =>
      delivery.http_status === null || (delivery.http_status ?? 0) >= 400,
  ).length;
  const recentInvoiceItems = allInvoices.slice(0, 5).map((invoice) => ({
    title: invoiceContext(invoice.metadata).title ?? invoice.id,
    invoiceId: invoice.id,
    detail: t("dashboard.page.createdAt", { date: new Date(invoice.created_at).toLocaleString(locale) }),
    href: `/invoice/${invoice.id}`,
    status: invoiceStatusLabel(
      invoice.status,
      invoice.amount_paid_xmr,
      invoice.amount_remaining_xmr,
      t,
    ),
    tone: invoiceStatusTones[invoice.status],
    dotClass:
      invoice.status === "confirmed"
        ? "bg-sage"
        : invoice.status === "payment_detected"
          ? "bg-monero"
          : invoice.status === "pending" || invoice.status === "partially_paid"
            ? "bg-clay"
            : "bg-red-500",
  }));
  const recentActivityItems = webhookHistory.slice(0, 4).map((delivery) => ({
    title: delivery.event,
    detail:
      delivery.http_status === null || delivery.http_status >= 400
        ? delivery.invoice_id ? t("dashboard.page.deliveryFailedFor", { id: delivery.invoice_id }) : t("dashboard.page.deliveryFailed")
        : delivery.invoice_id ? t("dashboard.page.deliveryRecordedFor", { id: delivery.invoice_id }) : t("dashboard.page.deliveryRecorded"),
    status:
      delivery.http_status === null || delivery.http_status >= 400
        ? t("dashboard.page.needsReview")
        : t("dashboard.page.accepted"),
    tone:
      delivery.http_status === null || delivery.http_status >= 400
        ? ("error" as StatusTone)
        : ("success" as StatusTone),
    dotClass:
      delivery.http_status === null || delivery.http_status >= 400
        ? "bg-red-500"
        : "bg-sage",
  }));
  const reconcilerStatusBadge = reconcilerBadge(systemStatus, t);
  const subTabBaseClass =
    "inline-flex items-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2";
  const subTabActiveClass =
    "border-ink bg-ink text-cream shadow-[0_6px_14px_rgba(16,18,23,0.12)]";
  const overviewMetrics = [
    {
      title: t("dashboard.page.invoicesToday"),
      value: invoicesTodayCount.toString(),
      detail: t("dashboard.page.invoicesTodayDetail"),
      href: "/dashboard?tab=invoices",
      accentClass: "border-t-clay",
      valueClass: "text-clay",
    },
    {
      title: t("dashboard.page.awaiting"),
      value: awaitingConfirmationCount.toString(),
      detail: t("dashboard.page.awaitingDetail"),
      href: "/dashboard?tab=invoices&status=payment_detected",
      accentClass: "border-t-monero",
      valueClass: "text-monero",
    },
    {
      title: t("dashboard.page.partial"),
      value: partiallyPaidCount.toString(),
      detail: t("dashboard.page.partialDetail"),
      href: "/dashboard?tab=invoices&status=partially_paid",
      accentClass: "border-t-amber-400",
      valueClass: "text-amber-900",
    },
    {
      title: t("dashboard.page.confirmed"),
      value: confirmedCount.toString(),
      detail: t("dashboard.page.confirmedDetail"),
      href: "/dashboard?tab=invoices&status=confirmed",
      accentClass: "border-t-sage",
      valueClass: "text-sage",
    },
    {
      title: t("dashboard.page.webhookIssues"),
      value: failedWebhookCount.toString(),
      detail: t("dashboard.page.webhookIssuesDetail"),
      href: "/dashboard?tab=webhooks&webhook_tab=history",
      accentClass: "border-t-red-500",
      valueClass: "text-red-700",
    },
  ];

  return (
    <main id="main-content" tabIndex={-1} className="px-[6vw] pb-16 pt-8 text-ink">
      <header
        className="mx-auto w-full max-w-7xl border-b border-stroke pb-5"
        aria-label={t("dashboard.page.headerLabel")}
      >
        <p className="text-sm font-semibold text-ink-soft">Dashboard</p>
        <p className="mt-1 font-sans text-2xl font-semibold leading-tight sm:text-3xl">
          {t("dashboard.page.workspace")}
        </p>
      </header>

      <section className="mx-auto mt-6 grid w-full max-w-7xl gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <WorkspaceNav
          activeValue={activeTab}
          ariaLabel={t("dashboard.page.sections")}
          items={dashboardNavItems(t)}
          mobileColumns={2}
          showIndexes={false}
        />

        <div className="min-w-0">
          {activeTab === "overview" ? (
            <section
              className="grid gap-6"
              aria-labelledby="dashboard-overview-title"
            >
              <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stroke pb-6">
                <div className="max-w-2xl">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span
                      className="h-2 w-2 rounded-full bg-clay"
                      aria-hidden="true"
                    />
                    {t("dashboard.page.navOverview")}
                  </p>
                  <h1
                    className="mt-1 font-sans text-3xl font-semibold leading-tight"
                    id="dashboard-overview-title"
                  >
                    {t("dashboard.page.overviewTitle")}
                  </h1>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
                  href="/dashboard?tab=invoices"
                >
                  {t("dashboard.page.openInvoices")}
                </Link>
              </header>

              <InvoiceAddressAvailability status={addressStatus} />

              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
                aria-label={t("dashboard.page.metrics")}
              >
                {overviewMetrics.map((item) => (
                  <Link
                    key={item.title}
                    className={`rounded-surface border border-stroke border-t-4 bg-white/70 p-5 shadow-soft transition hover:border-ink/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 ${item.accentClass}`}
                    href={item.href}
                  >
                    <p className="text-sm font-semibold text-ink-soft">
                      {item.title}
                    </p>
                    <p
                      className={`mt-3 font-mono text-3xl font-semibold ${item.valueClass}`}
                    >
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm text-ink-soft">{item.detail}</p>
                  </Link>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <section
                  className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft"
                  aria-labelledby="recent-invoices-title"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2
                        className="font-sans text-xl font-semibold"
                        id="recent-invoices-title"
                      >
                        {t("dashboard.page.recentInvoices")}
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        {t("dashboard.page.recentInvoicesHelp")}
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-ink underline underline-offset-4"
                      href="/dashboard?tab=invoices"
                    >
                      {t("dashboard.page.viewAll")}
                    </Link>
                  </div>
                  <div className="mt-4">
                    {recentInvoiceItems.length > 0 ? (
                      recentInvoiceItems.map((item) => (
                        <Link
                          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-stroke py-3 first:border-t-0 first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                          prefetch={false}
                          href={item.href}
                          key={`${item.title}-${item.detail}`}
                        >
                          <span
                            className={`mt-1.5 h-2.5 w-2.5 rounded-full ${item.dotClass}`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="break-words text-sm font-semibold text-ink">
                                {item.title}
                              </p>
                              <StatusBadge label={item.status} tone={item.tone} />
                            </div>
                            {item.title !== item.invoiceId ? <p className="mt-1 break-all font-mono text-xs text-ink-soft">{item.invoiceId}</p> : null}
                            <p className="mt-1 text-sm text-ink-soft">
                              {item.detail}
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-ink-soft">
                        {t("dashboard.page.noInvoices")}
                      </p>
                    )}
                  </div>
                </section>

                <section
                  className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft"
                  aria-labelledby="recent-activity-title"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2
                        className="font-sans text-xl font-semibold"
                        id="recent-activity-title"
                      >
                        {t("dashboard.page.recentDeliveries")}
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        {t("dashboard.page.recentDeliveriesHelp")}
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-ink underline underline-offset-4"
                      href="/dashboard?tab=webhooks&webhook_tab=history"
                    >
                      {t("dashboard.page.history")}
                    </Link>
                  </div>
                  <div className="mt-4">
                    {recentActivityItems.length > 0 ? (
                      recentActivityItems.map((item) => (
                        <div
                          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-stroke py-3 first:border-t-0 first:pt-0 last:pb-0"
                          key={`${item.title}-${item.detail}`}
                        >
                          <span
                            className={`mt-1.5 h-2.5 w-2.5 rounded-full ${item.dotClass}`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="break-all font-mono text-sm font-semibold text-ink">
                                {item.title}
                              </p>
                              <StatusBadge
                                label={item.status}
                                tone={item.tone}
                              />
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ink-soft">
                        {t("dashboard.page.noDeliveries")}
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft transition hover:border-ink/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href="/dashboard?tab=health"
                >
                  <p className="text-sm font-semibold text-ink-soft">{t("dashboard.page.navHealth")}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-sans text-xl font-semibold">
                      {reconcilerStatusBadge.label}
                    </p>
                    <StatusBadge
                      label={t("dashboard.page.openDetails")}
                      tone={reconcilerStatusBadge.tone}
                    />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {t("dashboard.page.healthHelp")}
                  </p>
                </Link>
                <Link
                  className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft transition hover:border-ink/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href="/dashboard?tab=webhooks"
                >
                  <p className="text-sm font-semibold text-ink-soft">{t("dashboard.page.endpoints")}</p>
                  <p className="mt-2 font-sans text-xl font-semibold">
                    {webhooksData.length === 0
                      ? t("dashboard.page.noEndpoints")
                      : t("dashboard.page.endpointCount", { count: webhooksData.length })}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">
                    {t("dashboard.page.endpointsHelp")}
                  </p>
                </Link>
              </div>

            </section>
          ) : null}

          {activeTab === "payment-links" ? <PaymentLinks selectedId={typeof resolvedSearchParams.link === "string" ? resolvedSearchParams.link : undefined} /> : null}
          {activeTab === "terminals" ? <Terminals /> : null}
          {activeTab === "health" ? (
            <div className="grid min-w-0 grid-cols-1 gap-6">
              <SystemHealthPanel status={systemStatus} />
              <InvoiceAddressAvailability status={addressStatus} full />
            </div>
          ) : null}

          {activeTab === "invoices" ? (
            <div className="grid min-w-0 grid-cols-1 gap-6">
              <InvoiceAddressAvailability status={addressStatus} compact />
              <InvoicePanel
                activeInvoices={allInvoices}
                includeArchived={includeArchived}
                searchQuery={invoiceSearchQuery}
                statusFilter={invoiceStatusFilter}
                sort={invoiceSort}
                order={invoiceOrder}
                page={invoicePage}
                pageSize={invoicePageSize}
                total={invoicesData?.total ?? 0}
                defaultConfirmationTarget={
                  profileData?.default_confirmation_target ?? 1
                }
              />
            </div>
          ) : null}

          {activeTab === "profile" ? (
            <section
              className="grid gap-6"
              aria-labelledby="profile-settings-title"
            >
              <header className="border-b border-stroke pb-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span
                    className="h-2 w-2 rounded-full bg-clay"
                    aria-hidden="true"
                  />
                  {t("dashboard.page.navProfile")}
                </p>
                <h1
                  className="mt-1 font-sans text-3xl font-semibold leading-tight"
                  id="profile-settings-title"
                >
                  {t("dashboard.page.profileTitle")}
                </h1>
                <p className="mt-2 max-w-2xl text-ink-soft">
                  {t("dashboard.page.profileHelp")}
                </p>
              </header>
              {apiKeyData ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <h2 className="font-sans text-xl font-semibold">
                      {t("dashboard.page.storeId")}
                    </h2>
                    <p className="mt-2 text-sm text-ink-soft">
                      {t("dashboard.page.storeIdHelp")}
                    </p>
                    <code className="mt-4 block break-all border-l-2 border-clay bg-sand/50 px-3 py-3 font-mono text-xs text-ink sm:text-sm">
                      {profileData?.id ?? t("health.unavailable")}
                    </code>
                  </section>
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <h2 className="font-sans text-xl font-semibold">{t("dashboard.page.apiKey")}</h2>
                    <p className="mt-2 text-sm text-ink-soft">
                      {t("dashboard.page.apiKeyHelp")}
                    </p>
                    <div className="mt-4">
                      <ApiKeySection apiKey={apiKeyData.api_key} />
                    </div>
                  </section>
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <h2 className="font-sans text-xl font-semibold">
                      {t("dashboard.page.webhookSecret")}
                    </h2>
                    <p className="mt-2 text-sm text-ink-soft">
                      {rich(t("dashboard.page.secretHelp"), { code: (text) => <code>{text}</code> })}
                    </p>
                    <div className="mt-4">
                      <WebhookSecretSection webhookSecret={webhookSecret} />
                    </div>
                  </section>
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <BtcpayCheckoutStyleSection
                      initialStyle={
                        profileData?.btcpay_checkout_style === "btcpay_classic"
                          ? "btcpay_classic"
                          : "btcpay_classic"
                      }
                    />
                  </section>
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <DefaultConfirmationTargetSection
                      initialValue={
                        profileData?.default_confirmation_target ?? 1
                      }
                    />
                  </section>
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <DefaultQrLogoSection
                      initialLogo={profileData?.default_qr_logo ?? "monero"}
                      initialLogoDataUrl={
                        profileData?.default_qr_logo_data_url ?? null
                      }
                    />
                  </section>
                </div>
              ) : (
                <div className="rounded-surface border border-stroke bg-white/70 p-6 shadow-soft">
                  <h2 className="font-sans text-xl font-semibold">
                    {t("dashboard.page.apiKeyUnavailable")}
                  </h2>
                  <p className="mt-2 text-ink-soft">
                    {t("dashboard.page.connectAgain")}
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "webhooks" ? (
            <section
              className="grid gap-6"
              aria-labelledby="webhook-endpoints-title"
            >
              <header className="border-b border-stroke pb-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span
                    className="h-2 w-2 rounded-full bg-clay"
                    aria-hidden="true"
                  />
                  {t("dashboard.page.navWebhooks")}
                </p>
                <h1
                  className="mt-1 font-sans text-3xl font-semibold leading-tight"
                  id="webhook-endpoints-title"
                >
                  {t("dashboard.page.endpoints")}
                </h1>
                <p className="mt-2 max-w-2xl text-ink-soft">
                  {t("dashboard.page.webhooksHelp")}
                </p>
              </header>
              <nav className="flex flex-wrap gap-2" aria-label={t("dashboard.page.webhookViews")}>
                {webhookTabs.map((tab) => (
                  <Link
                    key={tab}
                    aria-current={activeWebhookTab === tab ? "page" : undefined}
                    className={`${subTabBaseClass} ${
                      activeWebhookTab === tab ? subTabActiveClass : ""
                    }`}
                    href={`/dashboard?tab=webhooks&webhook_tab=${tab}`}
                  >
                    {tab === "settings" ? t("dashboard.page.settingsTab") : t("dashboard.page.history")}
                  </Link>
                ))}
              </nav>
              {activeWebhookTab === "settings" ? (
                <WebhookSection webhooks={webhooksData} />
              ) : null}
              {activeWebhookTab === "history" ? (
                <WebhookHistoryPanel deliveries={webhookHistory} />
              ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
