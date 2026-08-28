import type { Metadata } from "next";
import Link from "next/link";

import InvoicePanel from "../../../components/invoice-panel";
import PageIntroBand from "../../../components/page-intro-band";
import StatusBadge, { type StatusTone } from "../../../components/status-badge";
import TourInvoicePreview from "../../../components/tour-invoice-preview";
import WebhookHistoryPanel from "../../../components/webhook-history-panel";
import WebhookSection from "../../../components/webhook-section";
import WorkspaceNav from "../../../components/workspace-nav";

export const metadata: Metadata = {
  title: "Tour",
};

const tabs = ["overview", "invoices", "invoice", "webhooks"] as const;
const webhookTabs = ["settings", "history"] as const;
const invoiceStatuses = [
  "pending",
  "payment_detected",
  "confirmed",
  "expired",
  "invalid",
] as const;
type TourTab = (typeof tabs)[number];
type WebhookTab = (typeof webhookTabs)[number];
type InvoiceStatus = (typeof invoiceStatuses)[number];

const tabDetails: Record<
  TourTab,
  { index: string; label: string; detail: string }
> = {
  overview: {
    index: "01",
    label: "Overview",
    detail: "Activity and status",
  },
  invoices: {
    index: "02",
    label: "Invoices",
    detail: "Create and inspect",
  },
  invoice: {
    index: "03",
    label: "View invoice",
    detail: "Customer payment page",
  },
  webhooks: {
    index: "04",
    label: "Webhooks",
    detail: "Relay and history",
  },
};

const tourNavItems = tabs.map((tab) => ({
  value: tab,
  href: `/tour?tab=${tab}`,
  ...tabDetails[tab],
}));

type TourSearchParams = Record<string, string | string[] | undefined>;

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
  metadata?: Record<string, string> | null;
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

const buildNowFixture = () => {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const exampleAddress =
    "4DEMO_ADDRESS_EXAMPLE_ONLY_DO_NOT_USE_FOR_PAYMENTS_XXXXXXXXXXXXXXXXXXXXXX";

  const invoices: InvoiceSummary[] = [
    {
      id: "demo_inv_pending",
      address: `${exampleAddress}_001`,
      subaddress_index: 12,
      amount_xmr: "0.125",
      status: "pending",
      confirmation_target: 2,
      confirmations: 0,
      created_at: iso(-35 * 60 * 1000),
      archived_at: null,
      detected_at: null,
      confirmed_at: null,
      expires_at: iso(25 * 60 * 1000),
      metadata: {
        recipient_name: "Example customer",
        description: "Order #1027",
      },
    },
    {
      id: "demo_inv_detected",
      address: `${exampleAddress}_002`,
      subaddress_index: 13,
      amount_xmr: "0.420",
      status: "payment_detected",
      confirmation_target: 2,
      confirmations: 1,
      created_at: iso(-2 * 60 * 60 * 1000),
      archived_at: null,
      detected_at: iso(-18 * 60 * 1000),
      confirmed_at: null,
      expires_at: iso(55 * 60 * 1000),
      metadata: { description: "Subscription renewal" },
    },
    {
      id: "demo_inv_confirmed",
      address: `${exampleAddress}_003`,
      subaddress_index: 14,
      amount_xmr: "1.000",
      status: "confirmed",
      confirmation_target: 1,
      confirmations: 1,
      created_at: iso(-26 * 60 * 60 * 1000),
      archived_at: null,
      detected_at: iso(-25.5 * 60 * 60 * 1000),
      confirmed_at: iso(-25.3 * 60 * 60 * 1000),
      expires_at: iso(-25 * 60 * 60 * 1000),
      metadata: { recipient_name: "ACME Inc.", description: "Invoice #8841" },
    },
    {
      id: "demo_inv_expired",
      address: `${exampleAddress}_004`,
      subaddress_index: 15,
      amount_xmr: "0.050",
      status: "expired",
      confirmation_target: 2,
      confirmations: 0,
      created_at: iso(-5 * 24 * 60 * 60 * 1000),
      archived_at: iso(-4.5 * 24 * 60 * 60 * 1000),
      detected_at: null,
      confirmed_at: null,
      expires_at: iso(-4.8 * 24 * 60 * 60 * 1000),
      metadata: { description: "Abandoned checkout" },
    },
  ];

  const webhooks: WebhookSummary[] = [
    {
      id: "demo_hook_1",
      url: "https://example.com/xmrcheckout/webhook",
      events: [
        "invoice.created",
        "invoice.payment_detected",
        "invoice.confirmed",
      ],
      event_urls: {
        "invoice.expired": "https://example.com/xmrcheckout/invoice-expired",
      },
      active: true,
      created_at: iso(-9 * 24 * 60 * 60 * 1000),
    },
  ];

  const deliveries: WebhookDeliverySummary[] = [
    {
      id: "demo_delivery_1",
      webhook_id: "demo_hook_1",
      event: "invoice.payment_detected",
      url: "https://example.com/xmrcheckout/webhook",
      invoice_id: "demo_inv_detected",
      invoice_address: `${exampleAddress}_002`,
      invoice_subaddress_index: 13,
      invoice_amount_xmr: "0.420",
      invoice_status: "payment_detected",
      http_status: 200,
      error_message: null,
      created_at: iso(-17 * 60 * 1000),
    },
    {
      id: "demo_delivery_2",
      webhook_id: "demo_hook_1",
      event: "invoice.confirmed",
      url: "https://example.com/xmrcheckout/webhook",
      invoice_id: "demo_inv_confirmed",
      invoice_address: `${exampleAddress}_003`,
      invoice_subaddress_index: 14,
      invoice_amount_xmr: "1.000",
      invoice_status: "confirmed",
      http_status: 500,
      error_message: "Upstream returned 500",
      created_at: iso(-25.2 * 60 * 60 * 1000),
    },
  ];

  return {
    defaultConfirmationTarget: 2,
    invoices,
    webhooks,
    deliveries,
  };
};

export default async function TourPage({
  searchParams,
}: {
  searchParams: Promise<TourSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const tabParam = resolvedSearchParams?.tab;
  const activeTabValue = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const activeTab: TourTab = tabs.includes(activeTabValue as TourTab)
    ? (activeTabValue as TourTab)
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

  const fixture = buildNowFixture();
  const exampleInvoice =
    fixture.invoices.find((invoice) => invoice.status === "payment_detected") ??
    fixture.invoices[0]!;
  const invoices = includeArchived
    ? fixture.invoices
    : fixture.invoices.filter((invoice) => !invoice.archived_at);

  const isToday = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const invoicesTodayCount = invoices.filter((invoice) =>
    isToday(invoice.created_at),
  ).length;
  const awaitingConfirmationCount = invoices.filter(
    (invoice) => invoice.status === "payment_detected",
  ).length;
  const confirmedCount = invoices.filter(
    (invoice) => invoice.status === "confirmed",
  ).length;
  const failedWebhookCount = fixture.deliveries.filter(
    (delivery) => delivery.http_status !== null && delivery.http_status >= 400,
  ).length;
  const recentInvoiceItems = invoices.slice(0, 5).map((invoice) => ({
    title: invoice.id,
    detail: `Created ${new Date(invoice.created_at).toLocaleString()}`,
    status:
      invoice.status === "payment_detected"
        ? "Payment detected"
        : invoice.status === "pending"
          ? "Awaiting funds"
          : invoice.status === "confirmed"
            ? "Confirmed"
            : invoice.status === "invalid"
              ? "Invalid"
              : "Expired",
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
  const recentActivityItems = fixture.deliveries.slice(0, 4).map((delivery) => ({
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

  const overviewMetrics = [
    {
      title: "Invoices today",
      value: invoicesTodayCount.toString(),
      detail: "Created in this simulated workspace.",
      href: "/tour?tab=invoices",
      accentClass: "border-t-clay",
      valueClass: "text-clay",
    },
    {
      title: "Awaiting confirmation",
      value: awaitingConfirmationCount.toString(),
      detail: "Detected below the configured target.",
      href: "/tour?tab=invoices&status=payment_detected",
      accentClass: "border-t-monero",
      valueClass: "text-monero",
    },
    {
      title: "Confirmed",
      value: confirmedCount.toString(),
      detail: "Invoices that reached their target.",
      href: "/tour?tab=invoices&status=confirmed",
      accentClass: "border-t-sage",
      valueClass: "text-sage",
    },
    {
      title: "Webhook issues",
      value: failedWebhookCount.toString(),
      detail: "Recent deliveries ready to review.",
      href: "/tour?tab=webhooks&webhook_tab=history",
      accentClass: "border-t-red-500",
      valueClass: "text-red-700",
    },
  ];

  const subTabBaseClass =
    "inline-flex items-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-ink/40 hover:bg-white";
  const subTabActiveClass =
    "border-ink bg-ink text-cream shadow-[0_6px_14px_rgba(16,18,23,0.12)]";

  return (
    <main className="px-[6vw] pb-16 pt-8 text-ink">
      <section
        className="mx-auto w-full max-w-7xl"
        aria-label="Tour environment"
      >
        <PageIntroBand
          as="p"
          eyebrow="Tour workspace"
          title="Explore a merchant checkout workspace with simulated activity."
          description={
            <p>
              Inspect invoice activity, webhooks, and simulated state without
              connecting a wallet.
            </p>
          }
        />
      </section>

      <section className="mx-auto mt-6 grid w-full max-w-7xl gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <WorkspaceNav
          activeValue={activeTab}
          ariaLabel="Tour sections"
          items={tourNavItems}
          mobileColumns={2}
        />

        <div className="min-w-0">
          {activeTab === "overview" ? (
            <section
              className="grid gap-6"
              aria-labelledby="tour-overview-title"
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
                    id="tour-overview-title"
                  >
                    Merchant activity at a glance
                  </h1>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
                  href="/tour?tab=invoices"
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
                      href="/tour?tab=invoices"
                    >
                      View all
                    </Link>
                  </div>
                  <div className="mt-4">
                    {recentInvoiceItems.length > 0 ? (
                      recentInvoiceItems.map((item) => (
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
                              <StatusBadge label={item.status} tone={item.tone} />
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">
                              {item.detail}
                            </p>
                          </div>
                        </div>
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
                      href="/tour?tab=webhooks&webhook_tab=history"
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
                              <StatusBadge label={item.status} tone={item.tone} />
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
                <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft">
                  <p className="text-sm font-semibold text-ink-soft">
                    System health
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-sans text-xl font-semibold">Healthy</p>
                    <StatusBadge label="Simulated" tone="success" />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    Simulated payment observation services are available for this tour.
                  </p>
                </section>
                <Link
                  className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft transition hover:border-ink/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href="/tour?tab=webhooks"
                >
                  <p className="text-sm font-semibold text-ink-soft">
                    Webhook endpoints
                  </p>
                  <p className="mt-2 font-sans text-xl font-semibold">
                    {fixture.webhooks.length === 0
                      ? "No endpoints configured"
                      : `${fixture.webhooks.length} endpoint${fixture.webhooks.length === 1 ? "" : "s"}`}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">
                    Review simulated destinations and delivery history.
                  </p>
                </Link>
              </div>
            </section>
          ) : null}

          {activeTab === "invoices" ? (
            <InvoicePanel
              mode="tour"
              basePath="/tour"
              activeInvoices={invoices}
              includeArchived={includeArchived}
              searchQuery={invoiceSearchQuery}
              statusFilter={invoiceStatusFilter}
              sort={invoiceSort}
              order={invoiceOrder}
              defaultConfirmationTarget={fixture.defaultConfirmationTarget}
            />
          ) : null}

          {activeTab === "invoice" ? (
            <TourInvoicePreview invoice={exampleInvoice} />
          ) : null}

          {activeTab === "webhooks" ? (
            <section
              className="grid gap-6"
              aria-labelledby="tour-webhooks-title"
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
                  id="tour-webhooks-title"
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
                    href={`/tour?tab=webhooks&webhook_tab=${tab}`}
                  >
                    {tab === "settings" ? "Endpoints" : "Delivery history"}
                  </Link>
                ))}
              </nav>
              {activeWebhookTab === "settings" ? (
                <WebhookSection mode="tour" webhooks={fixture.webhooks} />
              ) : null}
              {activeWebhookTab === "history" ? (
                <WebhookHistoryPanel
                  mode="tour"
                  deliveries={fixture.deliveries}
                />
              ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
