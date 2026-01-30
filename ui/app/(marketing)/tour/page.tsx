import type { Metadata } from "next";
import Link from "next/link";

import InvoicePanel from "../../../components/invoice-panel";
import WebhookHistoryPanel from "../../../components/webhook-history-panel";
import WebhookSection from "../../../components/webhook-section";

export const metadata: Metadata = {
  title: "Tour",
};

const tabs = ["overview", "invoices", "webhooks"] as const;
const webhookTabs = ["settings", "history"] as const;
type TourTab = (typeof tabs)[number];
type WebhookTab = (typeof webhookTabs)[number];

type TourSearchParams = Record<string, string | string[] | undefined>;

type InvoiceSummary = {
  id: string;
  address: string;
  subaddress_index?: number | null;
  amount_xmr: string;
  status: "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
  confirmation_target: number;
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
      created_at: iso(-35 * 60 * 1000),
      archived_at: null,
      detected_at: null,
      confirmed_at: null,
      expires_at: iso(25 * 60 * 1000),
      metadata: { recipient_name: "Example customer", description: "Order #1027" },
    },
    {
      id: "demo_inv_detected",
      address: `${exampleAddress}_002`,
      subaddress_index: 13,
      amount_xmr: "0.420",
      status: "payment_detected",
      confirmation_target: 2,
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
      events: ["invoice.created", "invoice.payment_detected", "invoice.confirmed"],
      event_urls: { "invoice.expired": "https://example.com/xmrcheckout/invoice-expired" },
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
    paymentAddress: exampleAddress,
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

  const invoicesTodayCount = invoices.filter((invoice) => isToday(invoice.created_at)).length;
  const awaitingConfirmationCount = invoices.filter(
    (invoice) => invoice.status === "payment_detected"
  ).length;
  const confirmedCount = invoices.filter((invoice) => invoice.status === "confirmed").length;

  const tabBaseClass =
    "inline-flex items-center rounded-xl border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:-translate-y-0.5";
  const tabActiveClass =
    "border-ink bg-ink text-cream shadow-[0_12px_24px_rgba(16,18,23,0.18)]";
  const subTabBaseClass =
    "inline-flex items-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:-translate-y-0.5";
  const subTabActiveClass =
    "border-ink bg-ink text-cream shadow-[0_10px_18px_rgba(16,18,23,0.18)]";

  return (
    <main className="px-[6vw] py-12 text-ink">
      <section className="mx-auto grid w-full max-w-6xl gap-4">
        <div className="rounded-2xl border border-stroke bg-white/80 px-5 py-3 shadow-soft backdrop-blur">
          <p className="text-sm font-semibold text-ink">
            Tour mode uses simulated data. No wallet connection. No changes are saved.
          </p>
        </div>
      </section>
      <section className="mx-auto mt-6 grid w-full max-w-6xl gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="grid gap-6">
          <nav className="flex flex-col gap-2" aria-label="Tour sections">
            {tabs.map((tab) => (
              <Link
                key={tab}
                className={`${tabBaseClass} ${activeTab === tab ? tabActiveClass : ""}`}
                href={`/tour?tab=${tab}`}
              >
                {tab}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="grid gap-6">
          {activeTab === "overview" ? (
            <div className="rounded-2xl border border-stroke bg-white/80 p-8 shadow-card backdrop-blur">
              <h1 className="font-serif text-3xl">Operational overview.</h1>
              <p className="mt-2 text-ink-soft">
                Track invoice flow and confirmation progress at a glance.
              </p>
              <div className="mt-6 rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Primary address (example)
                </p>
                <p className="mt-3 break-all font-mono text-sm text-ink">
                  {fixture.paymentAddress}
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  This is an example address shown for the tour.
                </p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {[
                  {
                    title: "Invoices today",
                    value: invoicesTodayCount.toString(),
                    detail: "Totals update as invoices are created.",
                  },
                  {
                    title: "Invoices awaiting confirmation",
                    value: awaitingConfirmationCount.toString(),
                    detail: "Waiting for the configured confirmation target.",
                  },
                  {
                    title: "Confirmed invoices",
                    value: confirmedCount.toString(),
                    detail: "Confirmed on-chain invoices display here.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                      {item.title}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">{item.value}</h2>
                    <p className="mt-2 text-sm text-ink-soft">{item.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Webhook endpoints
                </p>
                {fixture.webhooks.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-soft">
                    No webhooks configured yet.{" "}
                    <Link className="font-semibold text-ink underline" href="/tour?tab=webhooks">
                      Add a webhook endpoint.
                    </Link>
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 text-sm text-ink">
                    {fixture.webhooks.map((webhook) => (
                      <div
                        className="rounded-xl border border-stroke bg-white/80 px-4 py-3"
                        key={webhook.id}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="break-all font-semibold">{webhook.url}</p>
                          <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink">
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
                We never hold funds. All payments move from the customer to your wallet.
              </div>
            </div>
          ) : null}
          {activeTab === "invoices" ? (
            <InvoicePanel
              mode="tour"
              basePath="/tour"
              activeInvoices={invoices}
              includeArchived={includeArchived}
              searchQuery={invoiceSearchQuery}
              sort={invoiceSort}
              order={invoiceOrder}
              defaultConfirmationTarget={fixture.defaultConfirmationTarget}
            />
          ) : null}
          {activeTab === "webhooks" ? (
            <div className="rounded-2xl border border-stroke bg-white/80 p-8 shadow-card backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-serif text-3xl">Webhook endpoints.</h1>
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
                    href={`/tour?tab=webhooks&webhook_tab=${tab}`}
                  >
                    {tab}
                  </Link>
                ))}
              </nav>
              {activeWebhookTab === "settings" ? (
                <div className="mt-6">
                  <WebhookSection mode="tour" webhooks={fixture.webhooks} />
                </div>
              ) : null}
              {activeWebhookTab === "history" ? (
                <div className="mt-6">
                  <WebhookHistoryPanel mode="tour" deliveries={fixture.deliveries} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

