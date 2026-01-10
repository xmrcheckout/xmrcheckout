import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

export const metadata: Metadata = {
  title: "Docs",
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  "http://localhost:8000";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000";
const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-900/10 text-emerald-800",
  POST: "bg-amber-900/15 text-amber-800",
  DELETE: "bg-red-900/10 text-red-700",
  PUT: "bg-blue-900/10 text-blue-800",
  PATCH: "bg-blue-900/10 text-blue-800",
};

const endpointGroups = [
  {
    title: "Login",
    auth: "None",
    items: [
      {
        method: "POST",
        path: "/api/core/auth/login",
        description: "Exchange a primary address and secret view key for an API key and webhook secret.",
      },
    ],
  },
  {
    title: "Public invoice status",
    auth: "None",
    items: [
      {
        method: "GET",
        path: "/api/core/public/invoice/{invoice_id}",
        description: "Read invoice status and payment details without auth.",
      },
      {
        method: "GET",
        path: "/api/core/public/invoice/{invoice_id}/continue",
        description: "After confirmation, redirect to the merchant-provided Continue URL (if configured).",
      },
    ],
  },
  {
    title: "Invoice workflow",
    auth: "API key",
    items: [
      {
        method: "GET",
        path: "/api/core/invoices",
        description: "List invoices for the signed-in user (supports search and sorting).",
      },
      {
        method: "GET",
        path: "/api/core/invoices/export.csv",
        description: "Export invoices as CSV (same filters as list endpoint).",
      },
      {
        method: "GET",
        path: "/api/core/invoices/{invoice_id}",
        description: "Retrieve a single invoice for the signed-in user.",
      },
      {
        method: "POST",
        path: "/api/core/invoices",
        description: "Create invoices for the signed-in user.",
      },
      {
        method: "DELETE",
        path: "/api/core/invoices/{invoice_id}",
        description:
          "Archive a pending invoice until it expires (payment-detected/confirmed invoices cannot be archived).",
      },
    ],
  },
  {
    title: "API key webhooks",
    auth: "API key",
    items: [
      {
        method: "GET",
        path: "/api/core/webhooks",
        description: "List active webhook registrations.",
      },
      {
        method: "GET",
        path: "/api/core/webhooks/history",
        description: "List recent webhook delivery attempts and HTTP status.",
      },
      {
        method: "POST",
        path: "/api/core/webhooks/deliveries/{delivery_id}/redeliver",
        description: "Manually redeliver a failed webhook delivery.",
      },
      {
        method: "POST",
        path: "/api/core/webhooks",
        description: "Register webhook URLs (single or per-event) and event filters.",
      },
      {
        method: "DELETE",
        path: "/api/core/webhooks/{webhook_id}",
        description: "Remove a webhook registration.",
      },
    ],
  },
  {
    title: "API key management",
    auth: "API key",
    items: [
      {
        method: "POST",
        path: "/api/core/api-credentials/reset",
        description: "Reset the API key, webhook secret, or both.",
      },
      {
        method: "PATCH",
        path: "/api/core/profile",
        description:
          "Update profile preferences like the BTCPay checkout layout or default confirmations.",
      },
    ],
  },
  {
    title: "BTCPay Greenfield stores",
    auth: "API key (token)",
    items: [
      {
        method: "GET",
        path: "/api/v1/stores",
        description: "List stores accessible to the API key.",
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}",
        description: "Retrieve a store by id.",
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/payment-methods",
        description: "List enabled payment methods (XMR-CHAIN only).",
      },
    ],
  },
  {
    title: "BTCPay Greenfield invoices",
    auth: "API key (token)",
    items: [
      {
        method: "POST",
        path: "/api/v1/stores/{store_id}/invoices",
        description: "Create a BTCPay-compatible invoice.",
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/invoices/{invoice_id}",
        description: "Retrieve a BTCPay-compatible invoice.",
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/invoices/{invoice_id}/payment-methods",
        description: "Return payment details for the invoice.",
      },
      {
        method: "POST",
        path: "/api/v1/stores/{store_id}/invoices/{invoice_id}/status",
        description: "Mark an invoice as Invalid (compatibility only).",
      },
    ],
  },
  {
    title: "BTCPay Greenfield webhooks",
    auth: "API key (token)",
    items: [
      {
        method: "POST",
        path: "/api/v1/stores/{store_id}/webhooks",
        description: "Register a webhook with authorized events.",
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/webhooks",
        description: "List registered webhooks for a store.",
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
        description: "Retrieve a webhook by id.",
      },
      {
        method: "PUT",
        path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
        description: "Update a webhook (enabled, url, or events).",
      },
      {
        method: "DELETE",
        path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
        description: "Delete a webhook registration.",
      },
    ],
  },
  {
    title: "BTCPay server info",
    auth: "API key (token)",
    items: [
      {
        method: "GET",
        path: "/api/v1/server/info",
        description: "Return server info for compatibility checks.",
      },
      {
        method: "GET",
        path: "/api/v1/api-keys/current",
        description: "Return the API key label and permissions.",
      },
    ],
  },
];

const endpointRequirements = [
  {
    method: "POST",
    path: "/api/core/auth/login",
    auth: "None",
    required: ["payment_address", "view_key"],
    optional: [],
    notes: [
      "Primary address only; subaddresses and integrated addresses are rejected.",
      "Use the secret view key (never submit a spend key).",
    ],
  },
  {
    method: "GET",
    path: "/api/core/public/invoice/{invoice_id}",
    auth: "None",
    required: ["invoice_id (path)"],
    optional: [],
    notes: ["Returns invoice status and payment details."],
  },
  {
    method: "GET",
    path: "/api/core/public/invoice/{invoice_id}/continue",
    auth: "None",
    required: ["invoice_id (path)"],
    optional: [],
    notes: [
      "Only available after an invoice is confirmed.",
      "Returns a 302 redirect to the merchant-provided checkout_continue_url (if configured).",
    ],
  },
  {
    method: "GET",
    path: "/api/core/invoices",
    auth: "API key",
    required: [],
    optional: [
      "limit (default 50, 1-100)",
      "offset (default 0)",
      "status",
      "include_archived (default false)",
      "q (invoice id, subaddress, metadata)",
      "sort (created_at, expires_at, amount_xmr, status, confirmations, confirmation_target)",
      "order (asc or desc)",
      "created_from (ISO timestamp)",
      "created_to (ISO timestamp)",
    ],
    notes: ["Returns invoices excluding archived entries."],
  },
  {
    method: "GET",
    path: "/api/core/invoices/export.csv",
    auth: "API key",
    required: [],
    optional: [
      "include_archived (default false)",
      "status",
      "q",
      "sort",
      "order",
      "created_from",
      "created_to",
    ],
    notes: ["Returns CSV with invoice rows."],
  },
  {
    method: "GET",
    path: "/api/core/invoices/{invoice_id}",
    auth: "API key",
    required: ["invoice_id (path)"],
    optional: [],
    notes: ["Returns a single invoice (archived invoices are excluded)."],
  },
  {
    method: "GET",
    path: "/api/core/webhooks",
    auth: "API key",
    required: [],
    optional: [],
    notes: ["Returns the most recent webhooks first."],
  },
  {
    method: "GET",
    path: "/api/core/webhooks/history",
    auth: "API key",
    required: [],
    optional: ["limit (default 50, 1-200)", "offset (default 0)"],
    notes: ["Returns the most recent webhook deliveries first."],
  },
  {
    method: "POST",
    path: "/api/core/webhooks/deliveries/{delivery_id}/redeliver",
    auth: "API key",
    required: ["delivery_id (path)"],
    optional: [],
    notes: ["Only failed deliveries can be redelivered."],
  },
  {
    method: "POST",
    path: "/api/core/webhooks",
    auth: "API key",
    required: ["events (at least one) or event_urls (at least one)"],
    optional: ["url", "event_urls", "events"],
    notes: [
      "Provide url for all selected events unless every event is mapped in event_urls.",
      "Events must be one of: invoice.created, invoice.payment_detected, invoice.confirmed, invoice.expired.",
    ],
  },
  {
    method: "DELETE",
    path: "/api/core/webhooks/{webhook_id}",
    auth: "API key",
    required: ["webhook_id (path)"],
    optional: [],
    notes: ["Returns 204 on success."],
  },
  {
    method: "POST",
    path: "/api/core/api-credentials/reset",
    auth: "API key",
    required: ["reset_api_key or reset_webhook_secret"],
    optional: [],
    notes: ["At least one reset flag must be true."],
  },
  {
    method: "PATCH",
    path: "/api/core/profile",
    auth: "API key",
    required: [],
    optional: ["btcpay_checkout_style", "default_confirmation_target"],
    notes: [
      "Set btcpay_checkout_style to standard or btcpay_classic.",
      "Applies to hosted invoice pages served for BTCPay compatibility.",
    ],
  },
  {
    method: "POST",
    path: "/api/core/invoices",
    auth: "API key",
    required: ["amount_xmr or amount_fiat + currency"],
    optional: [
      "confirmation_target (default 2, 0-10)",
      "checkout_continue_url (https URL, optional post-confirmation Continue button)",
      "metadata",
      "expires_at (ISO 8601)",
    ],
    notes: [
      "Fiat conversion is non-binding and does not lock a rate.",
      "Creates a pending invoice and returns invoice details.",
    ],
  },
  {
    method: "DELETE",
    path: "/api/core/invoices/{invoice_id}",
    auth: "API key",
    required: [],
    optional: [],
    notes: [
      "Only pending, expired, or invalid invoices can be archived. Returns 204 on success.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores",
    auth: "API key (token)",
    required: [],
    optional: [],
    notes: [
      "Single-store per user: the list returns one store.",
      "Store ids map to the authenticated user id.",
      "Header format: Authorization: token <api_key>.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}",
    auth: "API key (token)",
    required: ["store_id (path)"],
    optional: [],
    notes: [
      "Only the authenticated store id is valid.",
      "Returns the store metadata expected by Greenfield clients.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/payment-methods",
    auth: "API key (token)",
    required: ["store_id (path)"],
    optional: [],
    notes: ["Returns XMR-CHAIN as the only enabled payment method."],
  },
  {
    method: "POST",
    path: "/api/v1/stores/{store_id}/invoices",
    auth: "API key (token)",
    required: ["store_id (path)", "amount", "currency"],
    optional: ["metadata", "checkout"],
    notes: [
      "Fiat inputs are converted once at creation time and stored as metadata.",
      "Invoices are defined and payable in XMR only.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/invoices/{invoice_id}",
    auth: "API key (token)",
    required: ["store_id (path)", "invoice_id (path)"],
    optional: [],
    notes: ["Returns BTCPay-compatible status fields."],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/invoices/{invoice_id}/payment-methods",
    auth: "API key (token)",
    required: ["store_id (path)", "invoice_id (path)"],
    optional: [],
    notes: [
      "Read-only payment details derived from observed on-chain data.",
      "Returns a list even when only one payment method is enabled.",
    ],
  },
  {
    method: "POST",
    path: "/api/v1/stores/{store_id}/invoices/{invoice_id}/status",
    auth: "API key (token)",
    required: ["store_id (path)", "invoice_id (path)", "status"],
    optional: [],
    notes: ["Only supports status=Invalid for compatibility; no funds move."],
  },
  {
    method: "POST",
    path: "/api/v1/stores/{store_id}/webhooks",
    auth: "API key (token)",
    required: ["store_id (path)", "url", "authorizedEvents"],
    optional: ["enabled", "automaticRedelivery"],
    notes: [
      "Deliveries include BTCPay-Sig: sha256=<hmac>.",
      "Events follow BTCPay naming conventions for compatibility.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/webhooks",
    auth: "API key (token)",
    required: ["store_id (path)"],
    optional: [],
    notes: ["Returns the most recent webhooks first."],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
    auth: "API key (token)",
    required: ["store_id (path)", "webhook_id (path)"],
    optional: [],
    notes: ["Returns a single webhook registration."],
  },
  {
    method: "PUT",
    path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
    auth: "API key (token)",
    required: ["store_id (path)", "webhook_id (path)"],
    optional: ["enabled", "automaticRedelivery", "url", "authorizedEvents"],
    notes: ["Updates a webhook registration."],
  },
  {
    method: "DELETE",
    path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
    auth: "API key (token)",
    required: ["store_id (path)", "webhook_id (path)"],
    optional: [],
    notes: ["Returns 204 on success."],
  },
  {
    method: "GET",
    path: "/api/v1/server/info",
    auth: "API key (token)",
    required: [],
    optional: [],
    notes: ["Version is set for compatibility with refund UI behavior."],
  },
  {
    method: "GET",
    path: "/api/v1/api-keys/current",
    auth: "API key (token)",
    required: [],
    optional: [],
    notes: [
      "Permissions are store-scoped strings tied to one store id.",
      "Refund permissions are intentionally omitted.",
    ],
  },
];

const requirementsByEndpoint = Object.fromEntries(
  endpointRequirements.map((entry) => [`${entry.method} ${entry.path}`, entry])
);

export default function DocsPage() {
  return (
    <main className="px-[6vw] pb-20 pt-10 text-ink">
      <section className="grid max-w-[52rem] gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
          Documentation
        </p>
        <h1 className="font-serif text-[clamp(2.2rem,2rem+1.4vw,3.4rem)] leading-[1.1]">
          Monero checkout documentation & API reference.
        </h1>
        <p className="text-[1.05rem] leading-relaxed text-ink-soft">
          xmrcheckout.com generates invoices, detects Monero payments using view-only access,
          and relays status events. Setup is explicit: bring your primary address and secret
          view key - never spend keys, never custody.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-ink/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Customer → Merchant wallet
          </span>
          <span className="rounded-full bg-ink/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            No spend keys required
          </span>
          <span className="rounded-full bg-ink/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            OpenAPI schema available
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5"
            href="/docs/integrations"
          >
            Integration recipes
          </Link>
          <span className="text-sm text-ink-soft">
            Copy/paste examples for curl, Node, PHP, Python, and Go.
          </span>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Start here
        </p>
        <ol className="mt-3 grid gap-3 text-sm text-ink-soft sm:grid-cols-4">
          <li className="rounded-xl border border-stroke bg-white/70 p-4">
            <p className="font-semibold text-ink">1) Sign in (view-only)</p>
            <p className="mt-1">
              Use your primary address + secret view key to retrieve an API key.
            </p>
          </li>
          <li className="rounded-xl border border-stroke bg-white/70 p-4">
            <p className="font-semibold text-ink">2) Create an invoice</p>
            <p className="mt-1">
              Call <span className="font-mono text-ink">POST /api/core/invoices</span> and
              redirect the customer to the hosted invoice URL.
            </p>
          </li>
          <li className="rounded-xl border border-stroke bg-white/70 p-4">
            <p className="font-semibold text-ink">3) Optional: configure webhooks</p>
            <p className="mt-1">
              Subscribe to <span className="font-mono text-ink">invoice.confirmed</span> to
              get status events pushed to your system.
            </p>
          </li>
          <li className="rounded-xl border border-stroke bg-white/70 p-4">
            <p className="font-semibold text-ink">4) Confirm and fulfill</p>
            <p className="mt-1">
              Wait for <span className="font-mono text-ink">invoice.confirmed</span> (webhook
              or polling). You can also check the public status endpoint, then mark your
              order paid.
            </p>
          </li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:-translate-y-0.5"
            href="/docs/integrations"
          >
            See recipes
          </Link>
          <a
            className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:-translate-y-0.5"
            href={`${normalizedSiteUrl}/openapi.json`}
            rel="noreferrer"
            target="_blank"
          >
            OpenAPI JSON
          </a>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
        <h2 className="font-serif text-2xl">Fiat inputs (optional)</h2>
        <p className="mt-2 text-ink-soft">
          You can request an invoice using a fiat amount. The backend converts the
          value to XMR using the current rate and returns a non-binding quote in the
          response. The invoice is always stored in XMR.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl border border-stroke bg-ink px-6 py-5 text-xs leading-relaxed text-cream shadow-soft">
          <code>{`POST /api/core/invoices
Authorization: ApiKey <api_key>
Content-Type: application/json

{
  "amount_fiat": "100.00",
  "currency": "USD",
  "confirmation_target": 2,
  "checkout_continue_url": "https://merchant.example/thanks",
  "metadata": { "order_id": "ORDER-1234" }
}`}</code>
        </pre>
      </section>

      <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
          <h3 className="mb-2 font-serif text-xl">Core principles</h3>
          <p className="text-ink-soft">
            All behavior is constrained by non-custodial rules.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>Merchants retain wallet access (your keys, your funds)</li>
            <li>View-only access maximum</li>
            <li>No fiat rails or execution of financial actions</li>
          </ul>
        </div>
        <div className="rounded-xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
          <h3 className="mb-2 font-serif text-xl">Subaddress-only invoices</h3>
          <p className="text-ink-soft">
            Every invoice uses a subaddress derived from your primary address for
            clearer reconciliation.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>Subaddress index shown on each invoice</li>
            <li>Wallet lookahead controls discovery</li>
            <li>Subaddresses cycle through indices 1 to 100</li>
            <li>Wallets may require adding the index to view funds</li>
          </ul>
        </div>
        <div className="rounded-xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
          <h3 className="mb-2 font-serif text-xl">Invoice lifecycle</h3>
          <p className="text-ink-soft">
            Clear state transitions without hidden automation.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>Pending → Payment detected → Confirmed</li>
            <li>Pending → Expired</li>
            <li>Pending → Invalid (manual)</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
          <h3 className="mb-2 font-serif text-xl">Authentication</h3>
          <p className="text-ink-soft">
            Two auth modes keep integrations explicit and observable.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>API key for authenticated endpoints</li>
            <li>Primary address + secret view key to retrieve API credentials</li>
            <li>Headers: Authorization: ApiKey &lt;api_key&gt;</li>
            <li>BTCPay compatibility: Authorization: token &lt;api_key&gt;</li>
          </ul>
        </div>
        <div className="rounded-xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
          <h3 className="mb-2 font-serif text-xl">Webhook events</h3>
          <p className="text-ink-soft">Observable events for merchant systems.</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>invoice.created</li>
            <li>invoice.payment_detected</li>
            <li>invoice.confirmed</li>
            <li>invoice.expired</li>
            <li>Deliveries include the X-Webhook-Secret header</li>
            <li>Webhooks are optional; poll /api/core/public/invoice/&lt;invoice_id&gt; without auth</li>
          </ul>
        </div>
        <div className="rounded-xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
          <h3 className="mb-2 font-serif text-xl">Base URL</h3>
          <p className="text-ink-soft">
            The API can be reached from:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>{normalizedSiteUrl}/api/core</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
          <h3 className="mb-2 font-serif text-xl">BTCPay compatibility (WooCommerce)</h3>
          <p className="text-ink-soft">
            A Greenfield-compatible subset keeps the official WooCommerce plugin working
            without custodial behavior.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>
              Base URL uses <span className="font-mono text-ink">/api/v1</span>
            </li>
            <li>Supported endpoints: stores, invoices, payment methods, webhooks</li>
            <li>Invoices are defined in XMR; fiat inputs are quote-only metadata</li>
            <li>Modal checkout is supported; the hosted invoice page is recommended for clarity</li>
          </ul>
        </div>
        <div className="rounded-xl border border-stroke bg-white/60 p-6 shadow-soft backdrop-blur">
          <h3 className="mb-2 font-serif text-xl">BTCPay webhooks</h3>
          <p className="text-ink-soft">Deliveries are signed with the BTCPay header format.</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>
              <span className="font-mono text-ink">BTCPay-Sig: sha256=&lt;hmac&gt;</span>
            </li>
            <li>Event names follow BTCPay conventions for compatibility.</li>
          </ul>
        </div>
      </section>

      <section className="mt-12 grid gap-6">
        <div className="grid max-w-[52rem] gap-2">
          <h2 className="font-serif text-2xl">API reference</h2>
          <p className="text-ink-soft">
            Every endpoint exposed by the API is listed below, grouped by access
            mode.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {endpointGroups.map((group, index) => {
            const needsDivider =
              group.title.startsWith("BTCPay") &&
              endpointGroups[index - 1] &&
              !endpointGroups[index - 1].title.startsWith("BTCPay");

            return (
              <Fragment key={group.title}>
                {needsDivider ? (
                  <div className="h-px w-full bg-monero/70 lg:col-span-2" aria-hidden="true"></div>
                ) : null}
                <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-xl">{group.title}</h3>
                      <p className="text-sm font-semibold text-sage">
                        Auth: {group.auth}
                      </p>
                    </div>
                    <span className="rounded-full bg-ink/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink">
                      {group.items.length} endpoints
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {group.items.map((endpoint) => {
                      const requirements =
                        requirementsByEndpoint[`${endpoint.method} ${endpoint.path}`];

                      return (
                        <div
                          className="grid gap-4 rounded-xl border border-ink/10 bg-white/60 p-4 sm:grid-cols-[auto_1fr]"
                          key={`${endpoint.method}-${endpoint.path}`}
                        >
                          <span
                            className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${
                              methodStyles[endpoint.method] ?? "bg-ink/10 text-ink-soft"
                            }`}
                          >
                            {endpoint.method}
                          </span>
                          <div className="grid gap-2">
                            <div className="grid gap-1">
                              <span className="font-mono text-sm text-ink">
                                {endpoint.path}
                              </span>
                              <span className="text-sm text-ink-soft">
                                {endpoint.description}
                              </span>
                            </div>
                            {requirements ? (
                              <details className="rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm text-ink-soft">
                                <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.18em] text-sage">
                                  Requirements
                                </summary>
                                <div className="mt-2 grid gap-2">
                                  <div>
                                    <span className="font-semibold text-ink">
                                      Required:
                                    </span>{" "}
                                    {requirements.required.length > 0
                                      ? requirements.required.join(", ")
                                      : "None"}
                                  </div>
                                  {requirements.optional.length > 0 ? (
                                    <div>
                                      <span className="font-semibold text-ink">
                                        Optional:
                                      </span>{" "}
                                      {requirements.optional.join(", ")}
                                    </div>
                                  ) : null}
                                  {requirements.notes.length > 0 ? (
                                    <ul className="list-disc space-y-1 pl-5">
                                      {requirements.notes.map((note) => (
                                        <li key={note}>{note}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>
                              </details>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-white/60 px-5 py-4 text-sm text-ink-soft shadow-soft backdrop-blur">
          <span>Need the machine-readable schema?</span>
          <a
            className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:-translate-y-0.5"
            href={`${normalizedSiteUrl}/openapi.json`}
            rel="noreferrer"
            target="_blank"
          >
            OpenAPI JSON
          </a>
        </div>
      </section>

    </main>
  );
}
