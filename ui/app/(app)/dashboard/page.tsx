import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import ApiKeySection from "../../../components/api-key-section";
import BtcpayCheckoutStyleSection from "../../../components/btcpay-checkout-style-section";
import DefaultConfirmationTargetSection from "../../../components/default-confirmation-target-section";
import DefaultQrLogoSection from "../../../components/default-qr-logo-section";
import InvoicePanel from "../../../components/invoice-panel";
import PageIntroBand from "../../../components/page-intro-band";
import { formatRelativeTime } from "../../../components/relative-time";
import StatusBadge, { type StatusTone } from "../../../components/status-badge";
import WebhookHistoryPanel from "../../../components/webhook-history-panel";
import WebhookSecretSection from "../../../components/webhook-secret-section";
import WebhookSection from "../../../components/webhook-section";
import WorkspaceNav from "../../../components/workspace-nav";

export const metadata: Metadata = {
  title: "Dashboard",
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";
const tabs = ["overview", "invoices", "webhooks", "profile"] as const;
const webhookTabs = ["settings", "history"] as const;
const invoiceStatuses = [
  "pending",
  "payment_detected",
  "confirmed",
  "expired",
  "invalid",
] as const;
type DashboardTab = (typeof tabs)[number];
type WebhookTab = (typeof webhookTabs)[number];
type InvoiceStatus = (typeof invoiceStatuses)[number];

type DashboardSearchParams = Record<string, string | string[] | undefined>;
type InvoiceSummary = {
  id: string;
  address: string;
  subaddress_index?: number | null;
  amount_xmr: string;
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
  invoice_status:
    "pending" | "payment_detected" | "confirmed" | "expired" | "invalid" | null;
  http_status: number | null;
  error_message: string | null;
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
type SystemStatusSummary = {
  wallet_rpc: "ok" | "unreachable";
  daemon: "ok" | "unreachable" | "unknown";
  daemon_height: number | null;
  invoice_reconcile_interval_seconds: number;
  last_reconcile_started_at: string | null;
  last_reconcile_completed_at: string | null;
  last_reconcile_error: string | null;
};

const dashboardNavItems = [
  {
    value: "overview",
    href: "/dashboard?tab=overview",
    index: "01",
    label: "Overview",
    detail: "Activity and connectivity",
  },
  {
    value: "invoices",
    href: "/dashboard?tab=invoices",
    index: "02",
    label: "Invoices",
    detail: "Create and review invoices",
  },
  {
    value: "webhooks",
    href: "/dashboard?tab=webhooks",
    index: "03",
    label: "Webhooks",
    detail: "Endpoints and delivery history",
  },
  {
    value: "profile",
    href: "/dashboard?tab=profile",
    index: "04",
    label: "Profile",
    detail: "Credentials and defaults",
  },
];

const walletRpcBadge = (systemStatus: SystemStatusSummary | null) => {
  if (!systemStatus) {
    return {
      tone: "pending" as StatusTone,
      label: "Unavailable",
    };
  }
  if (systemStatus.wallet_rpc === "ok") {
    return {
      tone: "success" as StatusTone,
      label: "Connected",
    };
  }
  return {
    tone: "error" as StatusTone,
    label: "Down",
  };
};

const daemonBadge = (systemStatus: SystemStatusSummary | null) => {
  if (!systemStatus) {
    return {
      tone: "pending" as StatusTone,
      label: "Unavailable",
    };
  }
  if (systemStatus.daemon === "ok") {
    return {
      tone: "success" as StatusTone,
      label: "Connected",
    };
  }
  if (systemStatus.daemon === "unknown") {
    return {
      tone: "neutral" as StatusTone,
      label: "Not configured",
    };
  }
  return {
    tone: "error" as StatusTone,
    label: "Down",
  };
};

const formatStatus = (status: InvoiceStatus) => {
  if (status === "payment_detected") {
    return "Payment detected";
  }
  if (status === "pending") {
    return "Awaiting funds";
  }
  if (status === "confirmed") {
    return "Confirmed";
  }
  if (status === "invalid") {
    return "Invalid";
  }
  return "Expired";
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  const webhookSecret =
    (await cookies()).get("xmrcheckout_webhook_secret")?.value ?? null;
  if (!apiKey) {
    redirect("/?login=1");
  }

  const resolvedSearchParams = await searchParams;
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
  const invoiceStatusFilter: InvoiceStatus | "all" =
    activeTab === "invoices" &&
    invoiceStatuses.includes(statusValue as InvoiceStatus)
      ? (statusValue as InvoiceStatus)
      : "all";
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

  const invoiceLimit = 100;
  let invoicesData: { items: InvoiceSummary[]; total: number } | null = null;
  let offset = 0;
  let total = 0;
  const items: InvoiceSummary[] = [];
  do {
    const invoiceUrl = new URL(`${apiBaseUrl}/api/core/invoices`);
    invoiceUrl.searchParams.set("limit", invoiceLimit.toString());
    invoiceUrl.searchParams.set("offset", offset.toString());
    if (includeArchived) {
      invoiceUrl.searchParams.set("include_archived", "true");
    }
    if (invoiceSearchQuery) {
      invoiceUrl.searchParams.set("q", invoiceSearchQuery);
    }
    if (invoiceStatusFilter !== "all") {
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
      redirect("/?login=1");
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
  } while (offset < total);
  invoicesData = { items, total };

  if (
    activeTab === "overview" ||
    (activeTab === "webhooks" && activeWebhookTab === "settings")
  ) {
    const response = await fetch(`${apiBaseUrl}/api/core/webhooks`, {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) {
      redirect("/?login=1");
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
      redirect("/?login=1");
    }
    if (response.ok) {
      webhookHistory = (await response.json()) as WebhookDeliverySummary[];
    }
  }

  const allInvoices = invoicesData?.items ?? [];
  let profileData: ProfileSummary | null = null;
  let systemStatus: SystemStatusSummary | null = null;

  if (
    activeTab === "overview" ||
    activeTab === "profile" ||
    activeTab === "invoices"
  ) {
    const response = await fetch(`${apiBaseUrl}/api/core/profile`, {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) {
      redirect("/?login=1");
    }
    if (response.ok) {
      profileData = (await response.json()) as ProfileSummary;
    }
  }
  if (activeTab === "overview") {
    const response = await fetch(
      `${apiBaseUrl}/api/core/public/system/status`,
      {
        cache: "no-store",
      },
    );
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
  const confirmedCount = allInvoices.filter(
    (invoice) => invoice.status === "confirmed",
  ).length;
  const expiredOrInvalidCount = allInvoices.filter(
    (invoice) => invoice.status === "expired" || invoice.status === "invalid",
  ).length;
  const failedWebhookCount = webhookHistory.filter(
    (delivery) =>
      delivery.http_status === null || (delivery.http_status ?? 0) >= 400,
  ).length;
  const needsAttentionItems = [
    ...allInvoices
      .filter((invoice) => invoice.status === "payment_detected")
      .slice(0, 3)
      .map((invoice) => ({
        title: invoice.id,
        detail: `${invoice.confirmations ?? 0}/${invoice.confirmation_target} confirmations reached.`,
        href: `/invoice/${invoice.id}`,
        category: "Invoice",
        dotClass: "bg-monero",
      })),
    ...allInvoices
      .filter(
        (invoice) =>
          invoice.status === "expired" || invoice.status === "invalid",
      )
      .slice(0, 3)
      .map((invoice) => ({
        title: invoice.id,
        detail: `${formatStatus(invoice.status)} invoice needs merchant review.`,
        href: `/invoice/${invoice.id}`,
        category: "Invoice",
        dotClass: "bg-red-500",
      })),
    ...webhookHistory
      .filter(
        (delivery) =>
          delivery.http_status === null || (delivery.http_status ?? 0) >= 400,
      )
      .slice(0, 3)
      .map((delivery) => ({
        title: delivery.event,
        detail:
          delivery.http_status === null
            ? "Webhook delivery did not receive a response."
            : `Webhook returned HTTP ${delivery.http_status}.`,
        href: "/dashboard?tab=webhooks&webhook_tab=history",
        category: "Webhook",
        dotClass: "bg-red-500",
      })),
  ].slice(0, 5);
  const recentActivityItems = webhookHistory.slice(0, 4).map((delivery) => ({
    title: delivery.event,
    detail:
      delivery.http_status === null || delivery.http_status >= 400
        ? `Delivery failed for ${delivery.invoice_id ?? "an invoice"}.`
        : `Delivery recorded for ${delivery.invoice_id ?? "an invoice"}.`,
    status:
      delivery.http_status === null || delivery.http_status >= 400
        ? "Needs review"
        : "Accepted",
    tone:
      delivery.http_status === null || delivery.http_status >= 400
        ? ("error" as StatusTone)
        : ("success" as StatusTone),
    dotClass:
      delivery.http_status === null || delivery.http_status >= 400
        ? "bg-red-500"
        : "bg-sage",
  }));
  const walletStatusBadge = walletRpcBadge(systemStatus);
  const daemonStatusBadge = daemonBadge(systemStatus);
  const lastReconcileCompleted = systemStatus?.last_reconcile_completed_at
    ? formatRelativeTime(systemStatus.last_reconcile_completed_at)
    : null;
  const lastReconcileStarted = systemStatus?.last_reconcile_started_at
    ? formatRelativeTime(systemStatus.last_reconcile_started_at)
    : null;
  const subTabBaseClass =
    "inline-flex items-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2";
  const subTabActiveClass =
    "border-ink bg-ink text-cream shadow-[0_6px_14px_rgba(16,18,23,0.12)]";
  const overviewMetrics = [
    {
      title: "Invoices today",
      value: invoicesTodayCount.toString(),
      detail: "Created since the start of today.",
      href: "/dashboard?tab=invoices",
      accentClass: "border-t-clay",
      valueClass: "text-clay",
    },
    {
      title: "Awaiting confirmation",
      value: awaitingConfirmationCount.toString(),
      detail: "Detected below the configured target.",
      href: "/dashboard?tab=invoices&status=payment_detected",
      accentClass: "border-t-monero",
      valueClass: "text-monero",
    },
    {
      title: "Confirmed",
      value: confirmedCount.toString(),
      detail: "Invoices that reached their target.",
      href: "/dashboard?tab=invoices&status=confirmed",
      accentClass: "border-t-sage",
      valueClass: "text-sage",
    },
    {
      title: "Webhook issues",
      value: failedWebhookCount.toString(),
      detail: "Recent deliveries ready to review.",
      href: "/dashboard?tab=webhooks&webhook_tab=history",
      accentClass: "border-t-red-500",
      valueClass: "text-red-700",
    },
  ];

  return (
    <main className="px-[6vw] pb-16 pt-8 text-ink">
      <section
        className="mx-auto w-full max-w-7xl"
        aria-label="Merchant workspace status"
      >
        <PageIntroBand
          as="p"
          eyebrow="Merchant workspace"
          title="Monitor checkout activity without spend authority."
          description={
            <p>
              Payments move from each customer to your wallet. This workspace
              only observes invoice state and relays events you configure.
            </p>
          }
          facts={[
            { label: "Access", value: "View only" },
            {
              label: "Wallet RPC",
              value:
                activeTab === "overview"
                  ? walletStatusBadge.label
                  : "See overview",
            },
            {
              label: "Daemon",
              value:
                activeTab === "overview"
                  ? daemonStatusBadge.label
                  : "See overview",
            },
          ]}
        />
      </section>

      <section className="mx-auto mt-6 grid w-full max-w-7xl gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <WorkspaceNav
          activeValue={activeTab}
          ariaLabel="Dashboard sections"
          items={dashboardNavItems}
          title="Merchant views"
          description="Review activity, configure relays, and manage view-only access."
          footerTitle="Direct to merchant"
          footerDescription="This software detects payments. It cannot sign transactions or move funds."
          mobileColumns={2}
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
                    Overview
                  </p>
                  <h1
                    className="mt-1 font-sans text-3xl font-semibold leading-tight"
                    id="dashboard-overview-title"
                  >
                    Merchant activity at a glance
                  </h1>
                  <p className="mt-2 text-ink-soft">
                    Follow invoice state, confirmation progress, and webhook
                    delivery from one operational view.
                  </p>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
                  href="/dashboard?tab=invoices"
                >
                  Open invoices
                </Link>
              </header>

              <div
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                aria-label="Merchant metrics"
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
                  aria-labelledby="needs-attention-title"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2
                        className="font-sans text-xl font-semibold"
                        id="needs-attention-title"
                      >
                        Needs attention
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        Review these items before fulfilling orders.
                      </p>
                    </div>
                    <StatusBadge
                      label={`${expiredOrInvalidCount} expired or invalid`}
                      tone={expiredOrInvalidCount > 0 ? "error" : "neutral"}
                    />
                  </div>
                  <div className="mt-4">
                    {needsAttentionItems.length > 0 ? (
                      needsAttentionItems.map((item) => (
                        <Link
                          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-stroke py-3 first:border-t-0 first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                          href={item.href}
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
                              <StatusBadge label={item.category} />
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">
                              {item.detail}
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-ink-soft">
                        No invoices or webhook deliveries need review.
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
                        Recent webhook activity
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        Latest delivery attempts for invoice events.
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-ink underline underline-offset-4"
                      href="/dashboard?tab=webhooks&webhook_tab=history"
                    >
                      History
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
                        No webhook delivery attempts recorded yet.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <section
                className="overflow-hidden rounded-surface border border-stroke bg-card shadow-soft"
                aria-labelledby="connectivity-title"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 sm:px-6">
                  <div>
                    <h2
                      className="font-sans text-xl font-semibold"
                      id="connectivity-title"
                    >
                      Monero connectivity
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      Detection depends on the wallet RPC and daemon remaining
                      available.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      label={`Wallet RPC: ${walletStatusBadge.label}`}
                      tone={walletStatusBadge.tone}
                    />
                    <StatusBadge
                      label={`Daemon: ${daemonStatusBadge.label}`}
                      tone={daemonStatusBadge.tone}
                    />
                  </div>
                </div>
                <dl className="grid border-y border-stroke bg-white/60 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-stroke">
                  {[
                    {
                      label: "Daemon height",
                      value:
                        systemStatus?.daemon_height?.toLocaleString() ??
                        "Unavailable",
                    },
                    {
                      label: "Detection interval",
                      value: `${systemStatus?.invoice_reconcile_interval_seconds ?? 30}s`,
                    },
                    {
                      label: "Last successful check",
                      value: lastReconcileCompleted ?? "Not yet recorded",
                    },
                    {
                      label: "Last check started",
                      value: lastReconcileStarted ?? "Not yet recorded",
                    },
                  ].map((item) => (
                    <div
                      className="border-t border-stroke px-5 py-4 first:border-t-0 sm:[&:nth-child(2)]:border-t-0 xl:border-t-0"
                      key={item.label}
                    >
                      <dt className="text-xs font-semibold text-ink-soft">
                        {item.label}
                      </dt>
                      <dd className="mt-1 break-words font-mono text-sm font-semibold text-ink">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                  <p className="text-sm text-ink-soft">
                    If a payment stays at 0 confirmations, verify that the
                    daemon height continues to advance.
                  </p>
                  <div className="min-w-0 lg:border-l lg:border-stroke lg:pl-5">
                    <p className="text-xs font-semibold text-ink-soft">
                      Primary address
                    </p>
                    <code className="mt-1 block break-all text-xs text-ink">
                      {profileData?.payment_address ?? "Unavailable"}
                    </code>
                  </div>
                </div>
                {systemStatus?.last_reconcile_error ? (
                  <p className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">
                    Last detection error: {systemStatus.last_reconcile_error}
                  </p>
                ) : null}
              </section>

              <section
                className="rounded-surface border border-ink bg-ink p-5 text-cream shadow-card sm:p-6"
                aria-labelledby="webhook-summary-title"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-cream/70">
                      <span
                        className="h-2.5 w-2.5 rounded-full bg-sage"
                        aria-hidden="true"
                      />
                      Event relay
                    </p>
                    <h2
                      className="mt-1 font-sans text-xl font-semibold"
                      id="webhook-summary-title"
                    >
                      Webhook endpoints
                    </h2>
                  </div>
                  <Link
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-cream/30 bg-cream/10 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-cream/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70"
                    href="/dashboard?tab=webhooks"
                  >
                    Open webhooks
                  </Link>
                </div>
                {webhooksData.length === 0 ? (
                  <p className="mt-4 border-t border-cream/20 pt-4 text-sm text-cream/70">
                    No webhook endpoints are configured. Invoice status remains
                    available through the public read endpoint.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-cream/20 border-t border-cream/20">
                    {webhooksData.map((webhook) => (
                      <div
                        className="grid gap-3 py-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
                        key={webhook.id}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                webhook.active ? "bg-sage" : "bg-cream/40"
                              }`}
                              aria-hidden="true"
                            />
                            <span className="text-xs font-semibold text-cream/60">
                              {webhook.active ? "Active" : "Paused"}
                            </span>
                          </div>
                          <code className="mt-1 block break-all text-sm text-cream">
                            {webhook.url || "Per-event URLs only"}
                          </code>
                        </div>
                        <div className="min-w-0 lg:border-l lg:border-cream/20 lg:pl-5">
                          <p className="text-xs font-semibold text-cream/60">
                            Relayed events
                          </p>
                          <p className="mt-1 break-words font-mono text-sm leading-relaxed text-cream/90">
                            {webhook.events.join("  /  ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <p className="border-l-2 border-sage pl-4 text-sm font-semibold text-ink">
                We never hold funds. All payments move from the customer to your
                wallet.
              </p>
            </section>
          ) : null}

          {activeTab === "invoices" ? (
            <InvoicePanel
              activeInvoices={allInvoices}
              includeArchived={includeArchived}
              searchQuery={invoiceSearchQuery}
              statusFilter={invoiceStatusFilter}
              sort={invoiceSort}
              order={invoiceOrder}
              defaultConfirmationTarget={
                profileData?.default_confirmation_target ?? 1
              }
            />
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
                  Profile
                </p>
                <h1
                  className="mt-1 font-sans text-3xl font-semibold leading-tight"
                  id="profile-settings-title"
                >
                  Credentials and checkout defaults
                </h1>
                <p className="mt-2 max-w-2xl text-ink-soft">
                  Manage integration access, webhook verification, and defaults
                  for new invoices.
                </p>
              </header>
              {apiKeyData ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <h2 className="font-sans text-xl font-semibold">
                      Store id
                    </h2>
                    <p className="mt-2 text-sm text-ink-soft">
                      Single-store per primary address. Use this id in the
                      BTCPay WooCommerce plugin store field.
                    </p>
                    <code className="mt-4 block break-all border-l-2 border-clay bg-sand/50 px-3 py-3 font-mono text-xs text-ink sm:text-sm">
                      {profileData?.id ?? "Unavailable"}
                    </code>
                  </section>
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <h2 className="font-sans text-xl font-semibold">API key</h2>
                    <p className="mt-2 text-sm text-ink-soft">
                      Use this key only with authenticated API endpoints.
                    </p>
                    <div className="mt-4">
                      <ApiKeySection apiKey={apiKeyData.api_key} />
                    </div>
                  </section>
                  <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft sm:p-6">
                    <h2 className="font-sans text-xl font-semibold">
                      Webhook secret
                    </h2>
                    <p className="mt-2 text-sm text-ink-soft">
                      Sent with each delivery as the{" "}
                      <code>X-Webhook-Secret</code> header.
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
                    API key unavailable
                  </h2>
                  <p className="mt-2 text-ink-soft">
                    Sign in again to reveal your API key.
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
                  Webhooks
                </p>
                <h1
                  className="mt-1 font-sans text-3xl font-semibold leading-tight"
                  id="webhook-endpoints-title"
                >
                  Webhook endpoints
                </h1>
                <p className="mt-2 max-w-2xl text-ink-soft">
                  Relay invoice state updates to your systems. Optional
                  overrides let you target different URLs per event.
                </p>
              </header>
              <nav className="flex flex-wrap gap-2" aria-label="Webhook views">
                {webhookTabs.map((tab) => (
                  <Link
                    key={tab}
                    aria-current={activeWebhookTab === tab ? "page" : undefined}
                    className={`${subTabBaseClass} ${
                      activeWebhookTab === tab ? subTabActiveClass : ""
                    }`}
                    href={`/dashboard?tab=webhooks&webhook_tab=${tab}`}
                  >
                    {tab}
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
