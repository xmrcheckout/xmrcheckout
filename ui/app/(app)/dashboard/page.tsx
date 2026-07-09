import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import ApiKeySection from "../../../components/api-key-section";
import BtcpayCheckoutStyleSection from "../../../components/btcpay-checkout-style-section";
import DefaultConfirmationTargetSection from "../../../components/default-confirmation-target-section";
import DefaultQrLogoSection from "../../../components/default-qr-logo-section";
import InvoicePanel from "../../../components/invoice-panel";
import { formatRelativeTime } from "../../../components/relative-time";
import WebhookHistoryPanel from "../../../components/webhook-history-panel";
import WebhookSecretSection from "../../../components/webhook-secret-section";
import WebhookSection from "../../../components/webhook-section";

export const metadata: Metadata = {
  title: "Dashboard",
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";
const tabs = ["overview", "invoices", "webhooks", "profile"] as const;
const webhookTabs = ["settings", "history"] as const;
const invoiceStatuses = ["pending", "payment_detected", "confirmed", "expired", "invalid"] as const;
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
    | "pending"
    | "payment_detected"
    | "confirmed"
    | "expired"
    | "invalid"
    | null;
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

const walletRpcBadge = (systemStatus: SystemStatusSummary | null) => {
  if (!systemStatus) {
    return {
      className: "bg-amber-100 text-amber-900",
      label: "Wallet RPC unavailable",
    };
  }
  if (systemStatus.wallet_rpc === "ok") {
    return {
      className: "bg-emerald-100 text-emerald-900",
      label: "Wallet RPC ok",
    };
  }
  return {
    className: "bg-red-100 text-red-700",
    label: "Wallet RPC down",
  };
};

const daemonBadge = (systemStatus: SystemStatusSummary | null) => {
  if (!systemStatus) {
    return {
      className: "bg-amber-100 text-amber-900",
      label: "Daemon unavailable",
    };
  }
  if (systemStatus.daemon === "ok") {
    return {
      className: "bg-emerald-100 text-emerald-900",
      label: "Daemon connected",
    };
  }
  if (systemStatus.daemon === "unknown") {
    return {
      className: "bg-amber-100 text-amber-900",
      label: "Daemon not configured",
    };
  }
  return {
    className: "bg-red-100 text-red-700",
    label: "Daemon down",
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
  const webhookSecret = (await cookies()).get("xmrcheckout_webhook_secret")?.value ?? null;
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
    activeWebhookTabValue as WebhookTab
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
    activeTab === "invoices" && invoiceStatuses.includes(statusValue as InvoiceStatus)
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
  if (activeTab === "overview" || (activeTab === "webhooks" && activeWebhookTab === "history")) {
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

  if (activeTab === "overview" || activeTab === "profile" || activeTab === "invoices") {
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
    const response = await fetch(`${apiBaseUrl}/api/core/public/system/status`, {
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
    isToday(invoice.created_at)
  ).length;
  const awaitingConfirmationCount = allInvoices.filter(
    (invoice) => invoice.status === "payment_detected"
  ).length;
  const confirmedCount = allInvoices.filter(
    (invoice) => invoice.status === "confirmed"
  ).length;
  const expiredOrInvalidCount = allInvoices.filter(
    (invoice) => invoice.status === "expired" || invoice.status === "invalid"
  ).length;
  const failedWebhookCount = webhookHistory.filter(
    (delivery) => delivery.http_status === null || (delivery.http_status ?? 0) >= 400
  ).length;
  const needsAttentionItems = [
    ...allInvoices
      .filter((invoice) => invoice.status === "payment_detected")
      .slice(0, 3)
      .map((invoice) => ({
        title: invoice.id,
        detail: `${invoice.confirmations ?? 0}/${invoice.confirmation_target} confirmations reached.`,
        href: `/invoice/${invoice.id}`,
      })),
    ...allInvoices
      .filter((invoice) => invoice.status === "expired" || invoice.status === "invalid")
      .slice(0, 3)
      .map((invoice) => ({
        title: invoice.id,
        detail: `${formatStatus(invoice.status)} invoice needs merchant review.`,
        href: `/invoice/${invoice.id}`,
      })),
    ...webhookHistory
      .filter((delivery) => delivery.http_status === null || (delivery.http_status ?? 0) >= 400)
      .slice(0, 3)
      .map((delivery) => ({
        title: delivery.event,
        detail:
          delivery.http_status === null
            ? "Webhook delivery did not receive a response."
            : `Webhook returned HTTP ${delivery.http_status}.`,
        href: "/dashboard?tab=webhooks&webhook_tab=history",
      })),
  ].slice(0, 5);
  const recentActivityItems = webhookHistory.slice(0, 4).map((delivery) => ({
    title: delivery.event,
    detail:
      delivery.http_status === null || delivery.http_status >= 400
        ? `Delivery failed for ${delivery.invoice_id ?? "an invoice"}.`
        : `Delivery recorded for ${delivery.invoice_id ?? "an invoice"}.`,
  }));
  const walletStatusBadge = walletRpcBadge(systemStatus);
  const daemonStatusBadge = daemonBadge(systemStatus);
  const lastReconcileCompleted = systemStatus?.last_reconcile_completed_at
    ? formatRelativeTime(systemStatus.last_reconcile_completed_at)
    : null;
  const lastReconcileStarted = systemStatus?.last_reconcile_started_at
    ? formatRelativeTime(systemStatus.last_reconcile_started_at)
    : null;
  const tabBaseClass =
    "inline-flex items-center rounded-xl border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft transition hover:opacity-95";
  const tabActiveClass =
    "border-ink bg-ink text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)]";
  const subTabBaseClass =
    "inline-flex items-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft transition hover:opacity-95";
  const subTabActiveClass =
    "border-ink bg-ink text-cream shadow-[0_6px_14px_rgba(16,18,23,0.12)]";

  return (
    <main className="px-[6vw] py-12 text-ink">
      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="grid gap-6">
          <nav className="flex flex-col gap-2" aria-label="Dashboard sections">
            {tabs.map((tab) => (
              <Link
                key={tab}
                className={`${tabBaseClass} ${activeTab === tab ? tabActiveClass : ""}`}
                href={`/dashboard?tab=${tab}`}
              >
                {tab}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="grid gap-6">
          {activeTab === "overview" ? (
            <div className="rounded-2xl border border-stroke bg-white/80 p-8 shadow-card backdrop-blur">
              <h1 className="font-sans font-semibold text-3xl">Operational overview.</h1>
              <p className="mt-2 text-ink-soft">
                Review invoices, confirmations, webhooks, and Monero connectivity.
              </p>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {[
                  {
                    title: "Awaiting confirmation",
                    value: awaitingConfirmationCount.toString(),
                    detail: "Detected payments below the confirmation target.",
                    href: "/dashboard?tab=invoices&status=payment_detected",
                  },
                  {
                    title: "Expired or invalid",
                    value: expiredOrInvalidCount.toString(),
                    detail: "Invoices that may need merchant review.",
                    href: "/dashboard?tab=invoices",
                  },
                  {
                    title: "Webhook issues",
                    value: failedWebhookCount.toString(),
                    detail: "Recent deliveries without a successful response.",
                    href: "/dashboard?tab=webhooks&webhook_tab=history",
                  },
                ].map((item) => (
                  <Link
                    key={item.title}
                    className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft transition hover:opacity-95"
                    href={item.href}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      {item.title}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">{item.value}</h2>
                    <p className="mt-2 text-sm text-ink-soft">{item.detail}</p>
                  </Link>
                ))}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-sans font-semibold text-xl">Needs attention</h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        Items to review before fulfilling or troubleshooting orders.
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-ink underline underline-offset-4"
                      href="/dashboard?tab=invoices"
                    >
                      View invoices
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {needsAttentionItems.length > 0 ? (
                      needsAttentionItems.map((item) => (
                        <Link
                          className="rounded-xl border border-stroke bg-white/70 px-4 py-3 text-sm transition hover:bg-white"
                          href={item.href}
                          key={`${item.title}-${item.detail}`}
                        >
                          <p className="break-all font-semibold text-ink">{item.title}</p>
                          <p className="mt-1 text-ink-soft">{item.detail}</p>
                        </Link>
                      ))
                    ) : (
                      <p className="rounded-xl border border-stroke bg-white/70 px-4 py-3 text-sm text-ink-soft">
                        No invoices or webhook deliveries need review.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-sans font-semibold text-xl">Recent webhook activity</h2>
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
                  <div className="mt-4 grid gap-3">
                    {recentActivityItems.length > 0 ? (
                      recentActivityItems.map((item) => (
                        <div
                          className="rounded-xl border border-stroke bg-white/70 px-4 py-3 text-sm"
                          key={`${item.title}-${item.detail}`}
                        >
                          <p className="font-semibold text-ink">{item.title}</p>
                          <p className="mt-1 text-ink-soft">{item.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-stroke bg-white/70 px-4 py-3 text-sm text-ink-soft">
                        No webhook delivery attempts recorded yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Monero connectivity
                  </p>
                  <div className="flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em]">
                    <span
                      className={`rounded-full px-3 py-1 ${walletStatusBadge.className}`}
                    >
                      {walletStatusBadge.label}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 ${daemonStatusBadge.className}`}
                    >
                      {daemonStatusBadge.label}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      Current daemon height
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {systemStatus?.daemon_height?.toLocaleString() ?? "Unavailable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      Detection poll interval
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {systemStatus?.invoice_reconcile_interval_seconds ?? 30}s
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      Last successful reconcile
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {lastReconcileCompleted ?? "Not yet recorded"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      Last reconcile start
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {lastReconcileStarted ?? "Not yet recorded"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink-soft">
                  If payments stay at 0 confirmations, check that the daemon is connected
                  and that the height keeps advancing.
                </p>
                {systemStatus?.last_reconcile_error ? (
                  <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">
                    Last reconciler error: {systemStatus.last_reconcile_error}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Invoice totals
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div>
                      <p className="text-sm text-ink-soft">Created today</p>
                      <p className="text-lg font-semibold text-ink">
                        {invoicesTodayCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-ink-soft">Confirmed</p>
                      <p className="text-lg font-semibold text-ink">
                        {confirmedCount}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    Primary address
                  </p>
                  <p className="mt-3 break-all font-mono text-xs text-ink sm:text-sm">
                    {profileData?.payment_address ?? "Unavailable"}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">
                    This wallet address is used to derive invoice subaddresses.
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  Webhook endpoints
                </p>
                {webhooksData.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-soft">
                    No webhooks configured yet.{" "}
                    <Link className="font-semibold text-ink underline" href="/dashboard?tab=webhooks">
                      Add a webhook endpoint.
                    </Link>
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 text-sm text-ink">
                    {webhooksData.map((webhook) => (
                      <div
                        className="rounded-xl border border-stroke bg-white/80 px-4 py-3"
                        key={webhook.id}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="break-all font-semibold">{webhook.url}</p>
                          <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink">
                            {webhook.active ? "Active" : "Paused"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-ink-soft">
                          Events: {webhook.events.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-5 rounded-2xl border border-ink/10 bg-ink/10 px-4 py-3 text-sm font-semibold text-ink">
                We never hold funds. All payments move from the customer to your
                wallet.
              </div>
            </div>
          ) : null}
          {activeTab === "invoices" ? (
            <InvoicePanel
              activeInvoices={allInvoices}
              includeArchived={includeArchived}
              searchQuery={invoiceSearchQuery}
              statusFilter={invoiceStatusFilter}
              sort={invoiceSort}
              order={invoiceOrder}
              defaultConfirmationTarget={profileData?.default_confirmation_target ?? 1}
            />
          ) : null}
          {activeTab === "profile" ? (
            <>
              {apiKeyData ? (
                <div className="rounded-2xl border border-stroke bg-white/80 p-8 shadow-card backdrop-blur">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h1 className="font-sans font-semibold text-3xl">Profile settings.</h1>
                      <p className="mt-2 text-ink-soft">
                        Manage credentials and delivery settings for your integration.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <h2 className="font-sans font-semibold text-2xl">Store id</h2>
                      <p className="mt-2 min-h-[2.5rem] text-sm text-ink-soft">
                        Single-store per primary address. Use this id in the BTCPay
                        WooCommerce plugin store field.
                      </p>
                      <div className="mt-4">
                        <p className="break-all rounded-xl bg-ink/5 px-3 py-2 font-mono text-xs text-ink sm:text-sm">
                          {profileData?.id ?? "Unavailable"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <h2 className="font-sans font-semibold text-2xl">API key</h2>
                      <p className="mt-2 min-h-[2.5rem] text-sm text-ink-soft">
                        Use this key with authenticated endpoints.
                      </p>
                      <div className="mt-4">
                        <ApiKeySection apiKey={apiKeyData.api_key} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <h2 className="font-sans font-semibold text-2xl">Webhook secret</h2>
                      <p className="mt-2 min-h-[2.5rem] text-sm text-ink-soft">
                        Sent with each delivery as the{" "}
                        <code>X-Webhook-Secret</code> header.
                      </p>
                      <div className="mt-4">
                        <WebhookSecretSection webhookSecret={webhookSecret} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <BtcpayCheckoutStyleSection
                        initialStyle={
                          profileData?.btcpay_checkout_style === "btcpay_classic"
                            ? "btcpay_classic"
                            : "btcpay_classic"
                        }
                      />
                    </div>
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <DefaultConfirmationTargetSection
                        initialValue={profileData?.default_confirmation_target ?? 1}
                      />
                    </div>
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <DefaultQrLogoSection
                        initialLogo={profileData?.default_qr_logo ?? "monero"}
                        initialLogoDataUrl={profileData?.default_qr_logo_data_url ?? null}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-stroke bg-white/80 p-8 shadow-card backdrop-blur">
                  <h1 className="font-sans font-semibold text-3xl">API key</h1>
                  <p className="mt-2 text-ink-soft">
                    Sign in again to reveal your API key.
                  </p>
                </div>
              )}
            </>
          ) : null}
          {activeTab === "webhooks" ? (
            <div className="rounded-2xl border border-stroke bg-white/80 p-8 shadow-card backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-sans font-semibold text-3xl">Webhook endpoints.</h1>
                  <p className="mt-2 text-ink-soft">
                    Relay invoice state updates to your systems. Optional overrides let
                    you target different URLs per event.
                  </p>
                </div>
              </div>
              <nav className="mt-6 flex flex-wrap gap-2" aria-label="Webhook views">
                {webhookTabs.map((tab) => (
                  <Link
                    key={tab}
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
                <div className="mt-6">
                  <WebhookSection webhooks={webhooksData} />
                </div>
              ) : null}
              {activeWebhookTab === "history" ? (
                <div className="mt-6">
                  <WebhookHistoryPanel deliveries={webhookHistory} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
