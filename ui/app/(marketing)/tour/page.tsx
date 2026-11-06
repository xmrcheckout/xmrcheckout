import { publicPageMetadata } from "../../../lib/site-metadata";
import type { Metadata } from "next";
import { invoiceContext } from "../../../lib/invoice-display";
import Link from "next/link";

import InvoicePanel from "../../../components/invoice-panel";
import type { PaymentLinkData } from "../../../components/payment-link-editor";
import { PaymentLinksView } from "../../../components/payment-links";
import type { TerminalData } from "../../../components/terminal-editor";
import { TerminalsView } from "../../../components/terminals";
import PageIntroBand from "../../../components/page-intro-band";
import StatusBadge, { type StatusTone } from "../../../components/status-badge";
import TourInvoicePreview from "../../../components/tour-invoice-preview";
import WebhookHistoryPanel from "../../../components/webhook-history-panel";
import WebhookSection from "../../../components/webhook-section";
import WorkspaceNav from "../../../components/workspace-nav";
import { FIAT_CURRENCY_SUGGESTIONS } from "../../../lib/fiat-currencies";
import { invoiceStatusName } from "../../../lib/invoice-status";
import { rich } from "../../../lib/i18n/rich";
import { getI18n } from "../../../lib/i18n/server";
import { utcTimestamp } from "../../../lib/timestamps";
import type { Translate } from "../../../lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return publicPageMetadata({ title: t("tour.metaTitle"), description: t("tour.metaDescription"), path: "/tour", locale });
}

const tabs = ["overview", "invoices", "invoice", "payment-links", "terminals", "webhooks"] as const;
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

const tabDetails = (t: Translate): Record<
  TourTab,
  { index: string; label: string; detail: string }
> => ({
  overview: {
    index: "01",
    label: t("dashboard.page.navOverview"),
    detail: t("tour.navOverviewDetail"),
  },
  invoices: {
    index: "02",
    label: t("dashboard.page.navInvoices"),
    detail: t("tour.navInvoicesDetail"),
  },
  invoice: {
    index: "03",
    label: t("demo.invoice.view"),
    detail: t("tour.navInvoiceDetail"),
  },
  "payment-links": {
    index: "04",
    label: t("dashboard.page.navPaymentLinks"),
    detail: t("dashboard.page.navPaymentLinksDetail"),
  },
  terminals: {
    index: "05",
    label: t("dashboard.page.navTerminals"),
    detail: t("dashboard.page.navTerminalsDetail"),
  },
  webhooks: {
    index: "06",
    label: t("dashboard.page.navWebhooks"),
    detail: t("tour.navWebhooksDetail"),
  },
});

const tourNavItems = (t: Translate) => tabs.map((tab) => ({
  value: tab,
  href: `/tour?tab=${tab}`,
  ...tabDetails(t)[tab],
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

const buildNowFixture = (t: Translate) => {
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
        recipient_name: t("tour.fixture.customer"),
        description: t("tour.fixture.order"),
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
      metadata: { description: t("tour.fixture.renewal") },
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
      metadata: { recipient_name: "ACME Inc.", description: t("tour.fixture.invoice") },
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
      metadata: { description: t("tour.fixture.abandoned") },
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
      error_message: t("tour.fixture.upstream"),
      created_at: iso(-25.2 * 60 * 60 * 1000),
    },
  ];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost";
  const demoLinkUrl = (id: string) => new URL(`/pay/${id}`, siteUrl).href;
  const paymentLinks: PaymentLinkData[] = [
    {
      id: "demo_link_ebook",
      title: t("tour.fixture.linkEbook"),
      description: "",
      button_text: t("paymentLinks.editor.defaultButton"),
      amount_xmr: "0.05",
      amount_fiat: null,
      currency: "XMR",
      confirmation_target: 1,
      auto_create_invoice: true,
      checkout_continue_url: "https://example.com/thanks",
      confirmation_message: null,
      enabled: true,
      url: demoLinkUrl("demo_link_ebook"),
      action_url: demoLinkUrl("demo_link_ebook"),
      customer_amount: false,
      minimum_amount_xmr: null,
    },
    {
      id: "demo_link_tip",
      title: t("tour.fixture.linkTip"),
      description: "",
      button_text: t("tour.fixture.linkTipButton"),
      amount_xmr: null,
      amount_fiat: null,
      currency: null,
      confirmation_target: 0,
      auto_create_invoice: false,
      checkout_continue_url: null,
      confirmation_message: null,
      enabled: true,
      url: demoLinkUrl("demo_link_tip"),
      action_url: demoLinkUrl("demo_link_tip"),
      customer_amount: true,
      minimum_amount_xmr: "0.001",
    },
  ];
  const paymentLinkUsage = {
    remaining: 7,
    used: 3,
    daily_limit: 10,
    window_hours: 24,
    retrieved_at: iso(-60 * 1000),
    supported_currencies: FIAT_CURRENCY_SUGGESTIONS,
  };
  const terminals: TerminalData[] = [
    {
      id: "demo_terminal_counter",
      name: t("tour.fixture.terminalCounter"),
      default_currency: "EUR",
      confirmation_target: 0,
      expiry_minutes: 15,
      enabled: true,
      created_at: iso(-12 * 24 * 60 * 60 * 1000),
      last_used_at: iso(-42 * 60 * 1000),
    },
    {
      id: "demo_terminal_market",
      name: t("tour.fixture.terminalMarket"),
      default_currency: "XMR",
      confirmation_target: 1,
      expiry_minutes: 20,
      enabled: false,
      created_at: iso(-30 * 24 * 60 * 60 * 1000),
      last_used_at: null,
    },
  ];

  return {
    defaultConfirmationTarget: 1,
    invoices,
    webhooks,
    deliveries,
    paymentLinks,
    paymentLinkUsage,
    terminals,
  };
};

export default async function TourPage({
  searchParams,
}: {
  searchParams: Promise<TourSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { t } = await getI18n();
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

  const fixture = buildNowFixture(t);
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
    title: invoiceContext(invoice.metadata).title ?? invoice.id,
    invoiceId: invoice.id,
    detail: t("dashboard.page.createdAt", { date: utcTimestamp(invoice.created_at, t) }),
    status: invoiceStatusName(invoice.status, t),
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

  const overviewMetrics = [
    {
      title: t("dashboard.page.invoicesToday"),
      value: invoicesTodayCount.toString(),
      detail: t("tour.todayDetail"),
      href: "/tour?tab=invoices",
      accentClass: "border-t-clay",
      valueClass: "text-clay",
    },
    {
      title: t("dashboard.page.awaiting"),
      value: awaitingConfirmationCount.toString(),
      detail: t("dashboard.page.awaitingDetail"),
      href: "/tour?tab=invoices&status=payment_detected",
      accentClass: "border-t-monero",
      valueClass: "text-monero",
    },
    {
      title: t("dashboard.page.confirmed"),
      value: confirmedCount.toString(),
      detail: t("dashboard.page.confirmedDetail"),
      href: "/tour?tab=invoices&status=confirmed",
      accentClass: "border-t-sage",
      valueClass: "text-sage",
    },
    {
      title: t("dashboard.page.webhookIssues"),
      value: failedWebhookCount.toString(),
      detail: t("dashboard.page.webhookIssuesDetail"),
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
    <main id="main-content" tabIndex={-1} className="px-[6vw] pb-16 pt-8 text-ink">
      <section
        className="mx-auto w-full max-w-7xl"
        aria-label={t("tour.environment")}
      >
        {activeTab === "overview" ? <PageIntroBand
          as="p"
          eyebrow={t("tour.eyebrow")}
          title={t("tour.title")}
          description={
            <p>
              {t("tour.intro")}
            </p>
          }
        /> : <p className="border-b border-stroke pb-3 text-sm">{rich(t("tour.banner"), { strong: (text) => <strong>{text}</strong> })}</p>}
      </section>

      <section className="mx-auto mt-6 grid w-full max-w-7xl gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <WorkspaceNav
          activeValue={activeTab}
          ariaLabel={t("tour.sections")}
          items={tourNavItems(t)}
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
                    {t("dashboard.page.navOverview")}
                  </p>
                  <h1
                    className="mt-1 font-sans text-3xl font-semibold leading-tight"
                    id="tour-overview-title"
                  >
                    {t("dashboard.page.overviewTitle")}
                  </h1>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
                  href="/tour?tab=invoices"
                >
                  {t("dashboard.page.openInvoices")}
                </Link>
              </header>

              <div
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
                      href="/tour?tab=invoices"
                    >
                      {t("dashboard.page.viewAll")}
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
                        </div>
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
                      href="/tour?tab=webhooks&webhook_tab=history"
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
                        {t("dashboard.page.noDeliveries")}
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft">
                  <p className="text-sm font-semibold text-ink-soft">
                    {t("dashboard.page.navHealth")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-sans text-xl font-semibold">{t("dashboard.page.healthy")}</p>
                    <StatusBadge label={t("tour.simulated")} tone="success" />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {t("tour.healthHelp")}
                  </p>
                </section>
                <Link
                  className="rounded-surface border border-stroke bg-white/70 p-5 shadow-soft transition hover:border-ink/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href="/tour?tab=webhooks"
                >
                  <p className="text-sm font-semibold text-ink-soft">
                    {t("dashboard.page.endpoints")}
                  </p>
                  <p className="mt-2 font-sans text-xl font-semibold">
                    {fixture.webhooks.length === 0
                      ? t("dashboard.page.noEndpoints")
                      : t("dashboard.page.endpointCount", { count: fixture.webhooks.length })}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">
                    {t("tour.endpointsHelp")}
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

          {activeTab === "payment-links" ? (
            <PaymentLinksView
              mode="tour"
              links={fixture.paymentLinks}
              usage={fixture.paymentLinkUsage}
              addressStatus={null}
              target={fixture.defaultConfirmationTarget}
              selectedId={typeof resolvedSearchParams?.link === "string" ? resolvedSearchParams.link : undefined}
            />
          ) : null}

          {activeTab === "terminals" ? (
            <TerminalsView
              mode="tour"
              terminals={fixture.terminals}
              currencies={fixture.paymentLinkUsage.supported_currencies}
              addressStatus={null}
              selectedId={typeof resolvedSearchParams?.terminal === "string" ? resolvedSearchParams.terminal : undefined}
            />
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
                  {t("dashboard.page.navWebhooks")}
                </p>
                <h1
                  className="mt-1 font-sans text-3xl font-semibold leading-tight"
                  id="tour-webhooks-title"
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
                    href={`/tour?tab=webhooks&webhook_tab=${tab}`}
                  >
                    {tab === "settings" ? t("tour.endpointsTab") : t("tour.historyTab")}
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
