import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import ApiKeySection from "../../../components/api-key-section";
import BtcpayCheckoutStyleSection from "../../../components/btcpay-checkout-style-section";
import DefaultConfirmationTargetSection from "../../../components/default-confirmation-target-section";
import DefaultQrLogoSection from "../../../components/default-qr-logo-section";
import InvoicePanel from "../../../components/invoice-panel";
import WebhookHistoryPanel from "../../../components/webhook-history-panel";
import WebhookSecretSection from "../../../components/webhook-secret-section";
import WebhookSection from "../../../components/webhook-section";

export const metadata: Metadata = {
  title: "Dashboard",
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";
const tabs = ["overview", "invoices", "webhooks", "profile"] as const;
const webhookTabs = ["settings", "history"] as const;
type DashboardTab = (typeof tabs)[number];
type WebhookTab = (typeof webhookTabs)[number];

type DashboardSearchParams = Record<string, string | string[] | undefined>;
type InvoiceSummary = {
  id: string;
  address: string;
  subaddress_index?: number | null;
  amount_xmr: string;
  status: "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
  confirmation_target: number;
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
  if (activeTab === "webhooks" && activeWebhookTab === "history") {
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
              <h1 className="font-serif text-3xl">Operational overview.</h1>
              <p className="mt-2 text-ink-soft">
                Track invoice flow and confirmation progress at a glance.
              </p>
              <div className="mt-6 rounded-2xl border border-stroke bg-white/70 p-5 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Primary address
                </p>
                <p className="mt-3 break-all font-mono text-sm text-ink">
                  {profileData?.payment_address ?? "Unavailable"}
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  This is the wallet address used for your invoices.
                </p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {[
                  {
                    title: "Invoices today",
                    value: invoicesTodayCount.toString(),
                    detail: "Totals will appear once invoices are created.",
                  },
                  {
                    title: "Invoices awaiting confirmation",
                    value: awaitingConfirmationCount.toString(),
                    detail: "Waiting for the configured confirmation target.",
                  },
                  {
                    title: "Confirmed invoices",
                    value: confirmedCount.toString(),
                    detail: "Confirmed on-chain invoices will display here.",
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
              sort={invoiceSort}
              order={invoiceOrder}
              defaultConfirmationTarget={profileData?.default_confirmation_target ?? 10}
            />
          ) : null}
          {activeTab === "profile" ? (
            <>
              {apiKeyData ? (
                <div className="rounded-2xl border border-stroke bg-white/80 p-8 shadow-card backdrop-blur">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h1 className="font-serif text-3xl">Profile settings.</h1>
                      <p className="mt-2 text-ink-soft">
                        Manage credentials and delivery settings for your integration.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <h2 className="font-serif text-2xl">Store id</h2>
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
                      <h2 className="font-serif text-2xl">API key</h2>
                      <p className="mt-2 min-h-[2.5rem] text-sm text-ink-soft">
                        Use this key with authenticated endpoints.
                      </p>
                      <div className="mt-4">
                        <ApiKeySection apiKey={apiKeyData.api_key} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <h2 className="font-serif text-2xl">Webhook secret</h2>
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
                            : "standard"
                        }
                      />
                    </div>
                    <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft">
                      <DefaultConfirmationTargetSection
                        initialValue={profileData?.default_confirmation_target ?? 10}
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
                  <h1 className="font-serif text-3xl">API key</h1>
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
