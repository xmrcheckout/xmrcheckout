import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

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
import WorkspaceNav from "../../../components/workspace-nav";

export const metadata: Metadata = {
  title: "Dashboard",
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";
const tabs = ["overview", "invoices", "webhooks", "profile", "health"] as const;
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
type InvoiceStatusFilter = InvoiceStatus | "active" | "all";

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

const dashboardNavItems = [
  {
    value: "overview",
    href: "/dashboard?tab=overview",
    label: "Overview",
    detail: "Activity and connectivity",
  },
  {
    value: "invoices",
    href: "/dashboard?tab=invoices",
    label: "Invoices",
    detail: "Create and review invoices",
  },
  {
    value: "webhooks",
    href: "/dashboard?tab=webhooks",
    label: "Webhooks",
    detail: "Endpoints and delivery history",
  },
  {
    value: "profile",
    href: "/dashboard?tab=profile",
    label: "Profile",
    detail: "Credentials and defaults",
  },
  {
    value: "health",
    href: "/dashboard?tab=health",
    label: "System health",
    detail: "Detection and connectivity",
  },
];

const reconcilerBadge = (systemStatus: SystemStatusSummary | null) => {
  if (!systemStatus || systemStatus.reconciler === "unavailable") {
    return { tone: "pending" as StatusTone, label: "Unavailable" };
  }
  if (systemStatus.reconciler === "ok") {
    return { tone: "success" as StatusTone, label: "Healthy" };
  }
  return { tone: "error" as StatusTone, label: "Degraded" };
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

  let addressStatus: SubaddressStatus | null = null;
  if (["overview", "invoices", "health"].includes(activeTab)) {
    const response = await fetch(`${apiBaseUrl}/api/core/subaddresses/status`, {
      headers: { Authorization: `ApiKey ${apiKey}` },
      cache: "no-store",
    }).catch(() => null);
    if (response?.status === 401) redirect("/?login=1");
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
      redirect("/?login=1");
    }
    if (response.ok) {
      profileData = (await response.json()) as ProfileSummary;
    }
  }
  if (activeTab === "overview" || activeTab === "health") {
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
  const failedWebhookCount = webhookHistory.filter(
    (delivery) =>
      delivery.http_status === null || (delivery.http_status ?? 0) >= 400,
  ).length;
  const recentInvoiceItems = allInvoices.slice(0, 5).map((invoice) => ({
    title: invoice.id,
    detail: `Created ${new Date(invoice.created_at).toLocaleString()}`,
    href: `/invoice/${invoice.id}`,
    status: formatStatus(invoice.status),
    tone:
      invoice.status === "confirmed"
        ? ("success" as StatusTone)
        : invoice.status === "payment_detected"
          ? ("detected" as StatusTone)
          : invoice.status === "pending"
            ? ("pending" as StatusTone)
            : ("error" as StatusTone),
    dotClass:
      invoice.status === "confirmed"
        ? "bg-sage"
        : invoice.status === "payment_detected"
          ? "bg-monero"
          : invoice.status === "pending"
            ? "bg-clay"
            : "bg-red-500",
  }));
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
  const reconcilerStatusBadge = reconcilerBadge(systemStatus);
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
      <header
        className="mx-auto w-full max-w-7xl border-b border-stroke pb-5"
        aria-label="Dashboard header"
      >
        <p className="text-sm font-semibold text-ink-soft">Dashboard</p>
        <p className="mt-1 font-sans text-2xl font-semibold leading-tight sm:text-3xl">
          Merchant workspace
        </p>
      </header>

      <section className="mx-auto mt-6 grid w-full max-w-7xl gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <WorkspaceNav
          activeValue={activeTab}
          ariaLabel="Dashboard sections"
          items={dashboardNavItems}
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
                    Overview
                  </p>
                  <h1
                    className="mt-1 font-sans text-3xl font-semibold leading-tight"
                    id="dashboard-overview-title"
                  >
                    Merchant activity at a glance
                  </h1>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
                  href="/dashboard?tab=invoices"
                >
                  Open invoices
                </Link>
              </header>

              <InvoiceAddressAvailability status={addressStatus} />

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
                  aria-labelledby="recent-invoices-title"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2
                        className="font-sans text-xl font-semibold"
                        id="recent-invoices-title"
                      >
                        Recent invoices
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        Latest merchant invoices and their current status.
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-ink underline underline-offset-4"
                      href="/dashboard?tab=invoices"
                    >
                      View all
                    </Link>
                  </div>
                  <div className="mt-4">
                    {recentInvoiceItems.length > 0 ? (
                      recentInvoiceItems.map((item) => (
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
                              <StatusBadge label={item.status} tone={item.tone} />
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">
                              {item.detail}
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-ink-soft">
                        No invoices created yet.
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
                        Recent webhook deliveries
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        Latest attempts to send invoice events to your configured endpoints.
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

              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft transition hover:border-ink/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href="/dashboard?tab=health"
                >
                  <p className="text-sm font-semibold text-ink-soft">System health</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-sans text-xl font-semibold">
                      {reconcilerStatusBadge.label}
                    </p>
                    <StatusBadge
                      label="Open details"
                      tone={reconcilerStatusBadge.tone}
                    />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    Check the services that observe payments when confirmation
                    appears delayed.
                  </p>
                </Link>
                <Link
                  className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft transition hover:border-ink/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href="/dashboard?tab=webhooks"
                >
                  <p className="text-sm font-semibold text-ink-soft">Webhook endpoints</p>
                  <p className="mt-2 font-sans text-xl font-semibold">
                    {webhooksData.length === 0
                      ? "No endpoints configured"
                      : `${webhooksData.length} endpoint${webhooksData.length === 1 ? "" : "s"}`}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">
                    Review configured destinations and delivery history.
                  </p>
                </Link>
              </div>

            </section>
          ) : null}

          {activeTab === "health" ? (
            <div className="grid min-w-0 grid-cols-1 gap-6">
              <SystemHealthPanel status={systemStatus} />
              <InvoiceAddressAvailability status={addressStatus} full />
            </div>
          ) : null}

          {activeTab === "invoices" ? (
            <div className="grid min-w-0 grid-cols-1 gap-6">
              <InvoiceAddressAvailability status={addressStatus} />
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
                    {tab === "settings" ? "Settings" : "History"}
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
