import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import PageIntroBand from "../../../components/page-intro-band";
import CopyCodeBlock from "../../../components/copy-code-block";
import StatusBadge from "../../../components/status-badge";

export const metadata: Metadata = {
  title: "Monero Payment API Documentation",
  description:
    "Integrate self-hosted Monero invoices with the XMR Checkout API, public invoice pages, confirmation detection, and webhooks.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    type: "website",
    url: "/docs",
    siteName: "XMR Checkout",
    title: "Monero Payment API Documentation | XMR Checkout",
    description:
      "Integrate self-hosted Monero invoices with the XMR Checkout API, public invoice pages, confirmation detection, and webhooks.",
  },
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  "http://localhost:8000";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "http://localhost:3000";
const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-900/10 text-emerald-800",
  POST: "bg-amber-900/20 text-amber-800",
  DELETE: "bg-red-900/10 text-red-700",
  PUT: "bg-blue-900/10 text-blue-800",
  PATCH: "bg-blue-900/10 text-blue-800",
};

const codeBlockClass =
  "min-w-0 max-w-full overflow-x-auto rounded-xl border border-cream/20 bg-ink px-5 py-4 pr-24 text-xs leading-relaxed text-cream shadow-soft sm:px-6 sm:py-5";

const endpointGroups = [
{
  "title": "Payment-link management",
  "auth": "API key",
  "items": [
    {
      "method": "GET",
      "path": "/api/core/payment-links",
      "description": "List the signed-in merchant’s reusable payment templates."
    },
    {
      "method": "POST",
      "path": "/api/core/payment-links",
      "description": "Create a fixed-amount payment link; returns 201 with reusable and form-action URLs."
    },
    {
      "method": "PATCH",
      "path": "/api/core/payment-links/{link_id}",
      "description": "Replace settings or change only the enabled state of an owned link."
    },
    {
      "method": "GET",
      "path": "/api/core/payment-links/status",
      "description": "Read supported currencies and the merchant’s rolling public invoice allowance."
    }
  ]
},
{
  "title": "Public payment links",
  "auth": "None",
  "items": [
    {
      "method": "GET",
      "path": "/api/core/public/payment-links/{token}",
      "description": "Read an enabled product’s public details without allocating an invoice."
    },
    {
      "method": "POST",
      "path": "/api/core/public/payment-links/{token}/invoices",
      "description": "Submit an empty HTML form to create an invoice and receive a 303 redirect."
    }
  ]
},
  {
    title: "Connect wallet",
    auth: "None",
    items: [
      {
        method: "POST",
        path: "/api/core/auth/login",
        description:
          "Exchange the required wallet details for an API key and webhook secret.",
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
        description:
          "After confirmation, redirect to the merchant-provided Continue URL (if configured).",
      },
      {
        method: "GET",
        path: "/api/core/public/system/status",
        description:
          "Read daemon, wallet-rpc, block height, and invoice-detection health without auth.",
      },
      {
        method: "GET",
        path: "/api/core/public/rates/{currency}",
        description:
          "Read a non-binding XMR-to-fiat reference rate without auth.",
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
        description:
          "List invoices for the signed-in user (supports search and sorting).",
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
        description:
          "Register webhook URLs (single or per-event) and event filters.",
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
  "method": "GET",
  "path": "/api/core/payment-links",
  "auth": "API key",
  "required": [],
  "optional": [],
  "notes": [
    "Returns an array of owned templates, with IDs, settings, enabled state, reusable url, and action_url."
  ]
},
{
  "method": "POST",
  "path": "/api/core/payment-links",
  "auth": "API key",
  "required": [
    "title",
    "amount_xmr OR amount_fiat",
    "currency (when using amount_fiat)"
  ],
  "optional": [
    "description",
    "confirmation_target",
    "checkout_continue_url",
    "enabled"
  ],
  "notes": [
    "Title: 1–200 characters; description: up to 2000. Amounts must be positive and below 1000000; at most 12 decimal places for XMR or 2 for fiat-reference inputs.",
    "Use supported_currencies from the status endpoint. Saves do not contact the quote provider.",
    "Confirmation target: 0–10, defaulting to the merchant profile at save time. Enabled defaults to true. Invoices use the configured default lifetime (one hour by default).",
    "Return URLs require HTTPS, with HTTP allowed for localhost and 127.0.0.1. Metadata and expiry overrides are not supported on templates.",
    "Returns 201 with saved settings, id, url, and action_url."
  ]
},
{
  "method": "PATCH",
  "path": "/api/core/payment-links/{link_id}",
  "auth": "API key",
  "required": [
    "link_id (owned UUID path)",
    "complete settings OR enabled alone"
  ],
  "optional": [],
  "notes": [
    "Full settings use the creation fields; omitted optional fields take their creation defaults, so send all settings you intend to retain.",
    "An enabled-only body can disable a legacy link with invalid settings. Enabling validates all saved settings and returns 422 if correction is required.",
    "Returns updated settings and the same URLs. Existing invoices retain their snapshots and continue detection after disabling."
  ]
},
{
  "method": "GET",
  "path": "/api/core/payment-links/status",
  "auth": "API key",
  "required": [],
  "optional": [],
  "notes": [
    "Returns supported_currencies, daily_limit, used, remaining, window_hours, and retrieved_at. Counts are shared across the merchant’s links over the preceding 24 hours.",
    "Status is a non-reserving snapshot, returned with Cache-Control: no-store. Address availability is separately reported by /api/core/subaddresses/status."
  ]
},
{
  "method": "GET",
  "path": "/api/core/public/payment-links/{token}",
  "auth": "None",
  "required": [
    "token (public path identifier)"
  ],
  "optional": [],
  "notes": [
    "Returns title, description, amount_xmr, amount_fiat, currency, confirmation_target, and action_url. Disabled or unknown links return 404.",
    "Reading or previewing a link never creates an invoice. The reusable /pay/{token} URL is the hosted product review page."
  ]
},
{
  "method": "POST",
  "path": "/api/core/public/payment-links/{token}/invoices",
  "auth": "None",
  "required": [
    "token (public path identifier)",
    "empty form body"
  ],
  "optional": [],
  "notes": [
    "No API key, cookies, or JavaScript are required. Rejects query parameters and non-empty bodies with 400; all purchase settings come from the saved template.",
    "Success returns 303 to the hosted invoice; it does not return invoice JSON. Application errors are HTML, including unavailable links (404), merchant configuration errors (409), capacity/rate limits (429), and service/quote failures (503). Applicable responses include Retry-After.",
    "The default allowance is 10 creations per merchant per rolling 24 hours; the default Nginx limit is 6 requests per minute per client IP, burst 3. Other merchant and address limits also apply. Operators can configure these defaults.",
    "There is no duplicate-submission recovery or automatic retry. An interrupted response does not prove creation failed; check any received invoice URL or contact the merchant before retrying."
  ]
},
  {
    method: "POST",
    path: "/api/core/auth/login",
    auth: "None",
    required: ["payment_address", "view_key"],
    optional: [],
    notes: [
      "Primary address only; subaddresses and integrated addresses are rejected.",
      "Use the private view key (never submit a spend key).",
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
    path: "/api/core/public/system/status",
    auth: "None",
    required: [],
    optional: [],
    notes: [
      "Returns wallet-rpc and daemon reachability, current daemon height, reconciler health, heartbeat timestamps, and latest invoice-check counts.",
      "Use this endpoint to debug setup issues before sending a real payment.",
    ],
  },
  {
    method: "GET",
    path: "/api/core/public/rates/{currency}",
    auth: "None",
    required: ["currency (three-letter path code)"],
    optional: [],
    notes: [
      "Returns fiat units per XMR with a source and quote timestamp.",
      "Informational only; no rate is locked and no fiat outcome is promised.",
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
      "Every destination must use HTTPS and resolve only to public IP addresses; redirects are checked again before delivery.",
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
      "The destination must use HTTPS and resolve only to public IP addresses; redirects are checked again before delivery.",
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
  endpointRequirements.map((entry) => [`${entry.method} ${entry.path}`, entry]),
);

export default function DocsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="reference-page docs-page px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-7xl">
        <section aria-label="Documentation introduction">
          <PageIntroBand
            eyebrow="Documentation"
            id="docs-title"
            title="Quick start and API reference."
            description={
              <p>
                Create invoices, send customers to hosted invoice pages, and
                receive invoice status through polling or webhooks. Setup uses
                your primary address and private view key; spend keys are never
                requested.
              </p>
            }
          />
        </section>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
            href="/docs/integrations"
          >
            Integration recipes
          </Link>
          <span className="text-sm text-ink-soft">
            Copy/paste examples for curl, Node, PHP, Python, and Go.
          </span>
        </div>

        <aside className="mt-5 rounded-surface border border-stroke bg-sand/60 px-5 py-4 text-sm text-ink-soft sm:px-6">
          <span className="font-semibold text-ink">New to the setup?</span>{" "}
          Read the{" "}
          <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/self-hosted-monero-checkout">
            self-hosting guide
          </Link>{" "}
          or follow the{" "}
          <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/monero-payment-api-webhooks">
            API and webhook guide
          </Link>
          .
        </aside>

        <nav
          className="sticky top-3 z-10 mt-6 grid grid-cols-2 gap-1.5 rounded-surface border border-stroke bg-card/95 p-2 shadow-soft backdrop-blur sm:flex sm:flex-wrap"
          aria-label="Documentation sections"
        >
          {[
            { href: "#start", label: "Start" },
            { href: "#payment-links", label: "Payment links" },
            { href: "#fiat-inputs", label: "Fiat inputs" },
            { href: "#concepts", label: "Concepts" },
            { href: "#api-reference", label: "API reference" },
          ].map((item, index) => (
            <a
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-stroke hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
              key={item.href}
              href={item.href}
            >
              <span className="font-mono text-xs text-ink-soft">
                0{index + 1}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <section
          id="start"
          className="mt-8 scroll-mt-24 overflow-hidden rounded-surface border border-stroke bg-card shadow-soft"
          aria-labelledby="start-title"
        >
          <header className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-clay"
                  aria-hidden="true"
                />
                Start here
              </p>
              <h2
                className="mt-1 font-sans text-2xl font-semibold"
                id="start-title"
              >
                Create and check an invoice.
              </h2>
            </div>
          </header>
          <ol className="grid divide-y divide-stroke border-y border-stroke bg-white/60 md:grid-cols-3 md:divide-x md:divide-y-0">
            <li className="min-w-0 px-5 py-5 sm:px-6">
              <span className="font-mono text-xs text-ink-soft">01</span>
              <p className="mt-2 font-semibold text-ink">
                Connect
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Use the sign-in form to retrieve an API key.
              </p>
            </li>
            <li className="min-w-0 px-5 py-5 sm:px-6">
              <span className="font-mono text-xs text-ink-soft">02</span>
              <p className="mt-2 font-semibold text-ink">Create an invoice</p>
              <p className="mt-1 text-sm text-ink-soft">
                Call{" "}
                <span className="font-mono text-ink">
                  POST /api/core/invoices
                </span>{" "}
                and send the customer to the hosted invoice URL.
              </p>
            </li>
            <li className="min-w-0 px-5 py-5 sm:px-6">
              <span className="font-mono text-xs text-ink-soft">03</span>
              <p className="mt-2 font-semibold text-ink">Listen for status</p>
              <p className="mt-1 text-sm text-ink-soft">
                Subscribe to webhooks or poll the public invoice endpoint until
                <span className="font-mono text-ink"> invoice.confirmed</span>.
              </p>
            </li>
          </ol>
          <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-ink">Minimal request</p>
              <p className="mt-2 max-w-xl text-sm text-ink-soft">
                The response includes the invoice id, payment address, amount,
                and hosted invoice URL.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href="/docs/integrations"
                >
                  See recipes
                </Link>
                <a
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href={`${normalizedSiteUrl}/openapi.json`}
                  rel="noreferrer"
                  target="_blank"
                >
                  OpenAPI JSON
                </a>
              </div>
            </div>
            <CopyCodeBlock className={codeBlockClass}>
              <code>{`POST /api/core/invoices
Authorization: ApiKey <api_key>
Content-Type: application/json

{
  "amount_xmr": "0.125",
  "confirmation_target": 2,
  "metadata": { "order_id": "ORDER-1234" }
}`}</code>
            </CopyCodeBlock>
          </div>
        </section>

        <section id="payment-links" aria-labelledby="payment-links-title" className="mt-10 grid min-w-0 scroll-mt-24 gap-5 break-words rounded-surface border border-stroke bg-card p-5 sm:p-8">
          <h2 id="payment-links-title" className="font-sans text-2xl font-semibold">Reusable payment links and HTML buttons</h2>
          <p>Merchants can configure a fixed amount in the dashboard and copy HTML into an independent website without programming. Each successful submission creates a separate XMR invoice; opening a reusable URL shows a review page first unless the merchant enables auto_create_invoice (default false). Automatic mode creates an invoice from the active browser and resumes the same attempt in the same tab.</p>
          <p><Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/monero-payment-buttons">Follow the merchant setup guide</Link> for wallet prerequisites, embedding, capacity, and manual fulfillment. The API operations below support managing those same templates from an integration.</p>
          <details className="min-w-0 rounded-xl border border-stroke p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">API examples and response behavior</summary>
            <p className="mt-3">Create a €20 reference template with a merchant API key held on your server. Fiat-reference inputs produce an XMR amount only when an invoice is requested; no rate or fiat outcome is guaranteed.</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`POST /api/core/payment-links
Authorization: ApiKey YOUR_MERCHANT_API_KEY
Content-Type: application/json

{
  "title": "Digital guide",
  "amount_fiat": "20.00",
  "currency": "EUR",
  "confirmation_target": 2,
  "enabled": true
}`}</code></CopyCodeBlock>
            <p className="mt-3">The 201 response includes saved settings and these selected fields. Tokens and IDs here are placeholders; use the returned URLs.</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`{
  "id": "00000000-0000-4000-8000-000000000001",
  "url": "https://checkout.example/pay/YOUR_PUBLIC_TOKEN",
  "action_url": "https://checkout.example/api/core/public/payment-links/YOUR_PUBLIC_TOKEN/invoices"
}`}</code></CopyCodeBlock>
            <p className="mt-3">To read the current allowance, send an authenticated GET to /api/core/payment-links/status. Example response:</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`{
  "supported_currencies": ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "HKD", "SGD", "INR", "BRL", "MXN", "SEK", "NOK", "DKK", "ZAR", "PLN", "KRW"],
  "daily_limit": 10,
  "used": 2,
  "remaining": 8,
  "window_hours": 24,
  "retrieved_at": "2026-10-30T12:00:00Z"
}`}</code></CopyCodeBlock>
            <p className="mt-3">A form sends an empty public POST, without merchant credentials. Automatic clients may send a UUID Idempotency-Key header and Accept: application/json. A new attempt returns 201; replay returns 200 with the same invoice_url, status, and expires_at. Save the key before requesting creation and retain it after interrupted responses. GET and HEAD never create invoices. An illustrative successful exchange is:</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`POST /api/core/public/payment-links/YOUR_PUBLIC_TOKEN/invoices
Content-Type: application/x-www-form-urlencoded
Content-Length: 0

HTTP/1.1 303 See Other
Location: https://checkout.example/invoice/NEW_INVOICE_ID`}</code></CopyCodeBlock>
            <p className="mt-3">On failure, the browser receives HTML explaining unavailability and any applicable Retry-After guidance. Do not automatically retry an uncertain request; it may already have created an invoice. Amount, wallet, confirmation, and URL overrides are rejected.</p>
            <p className="mt-3">For editing, PATCH accepts full settings using the creation fields, or an enabled-only body such as {`{"enabled": false}`}. Re-enabling with {`{"enabled": true}`} validates saved settings. Full-settings updates replace omitted optional fields with defaults. The returned URLs remain stable; existing invoices retain their product snapshots.</p>
          </details>
          <p>Find the six operations in the Payment-link management and Public payment links groups in the <a href="#api-reference" className="font-semibold underline underline-offset-4">endpoint directory</a>.</p>
        </section>

        <section
          id="fiat-inputs"
          className="mt-10 grid scroll-mt-24 overflow-hidden rounded-surface border border-stroke bg-sand/60 shadow-soft lg:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)] lg:items-stretch"
          aria-labelledby="fiat-inputs-title"
        >
          <div className="px-5 py-6 sm:px-6 lg:py-7">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="h-2.5 w-2.5 rounded-full bg-sage"
                aria-hidden="true"
              />
              Optional input
            </p>
            <h2
              className="mt-1 font-sans text-2xl font-semibold"
              id="fiat-inputs-title"
            >
              Fiat inputs (optional)
            </h2>
            <p className="mt-3 text-ink-soft">
              You can request an invoice using a fiat amount. The backend
              converts the value to XMR using the current rate and returns a
              non-binding quote in the response. The invoice is always stored in
              XMR.
            </p>
            <StatusBadge
              className="mt-4"
              label="Non-binding quote"
              tone="neutral"
            />
          </div>
          <CopyCodeBlock
            className={`${codeBlockClass} m-4 lg:m-0 lg:rounded-none lg:border-0 lg:shadow-none`}
          >
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
          </CopyCodeBlock>
        </section>

        <section
          id="concepts"
          className="mt-12 grid scroll-mt-24 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <header className="border-b border-stroke pb-5 sm:col-span-2 lg:col-span-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="h-2.5 w-2.5 rounded-full bg-clay"
                aria-hidden="true"
              />
              System model
            </p>
            <h2 className="mt-1 font-sans text-2xl font-semibold">
              Concepts and boundaries
            </h2>
            <p className="mt-1 max-w-2xl text-ink-soft">
              The operating rules, access model, and compatibility details
              behind the API.
            </p>
          </header>
          <div className="rounded-surface border border-stroke border-t-4 border-t-clay bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              Core principles
            </h3>
            <p className="text-ink-soft">
              All behavior is constrained by non-custodial rules.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>Merchants retain wallet access (your keys, your funds)</li>
              <li>View-only access maximum</li>
              <li>No fiat rails or execution of financial actions</li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke border-t-4 border-t-sage bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              Subaddress-only invoices
            </h3>
            <p className="text-ink-soft">
              Every invoice uses a subaddress derived from your primary address
              for clearer reconciliation.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>Subaddress index shown on each invoice</li>
              <li>Wallet lookahead controls discovery</li>
              <li>Subaddresses cycle through indices 1 to 100</li>
              <li>Wallets may require adding the index to view funds</li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke border-t-4 border-t-monero bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              Invoice lifecycle
            </h3>
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

        <section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-surface border border-stroke bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              Authentication
            </h3>
            <p className="text-ink-soft">
              Two auth modes keep integrations explicit and observable.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>API key for authenticated endpoints</li>
              <li>
                Primary address + private view key to retrieve API credentials
              </li>
              <li>Headers: Authorization: ApiKey &lt;api_key&gt;</li>
              <li>
                BTCPay compatibility: Authorization: token &lt;api_key&gt;
              </li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              Webhook events
            </h3>
            <p className="text-ink-soft">
              Observable events for merchant systems.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>invoice.created</li>
              <li>invoice.payment_detected</li>
              <li>invoice.confirmed</li>
              <li>invoice.expired</li>
              <li>Deliveries include the X-Webhook-Secret header</li>
              <li>
                Destinations must use HTTPS and resolve only to public IP
                addresses; redirect destinations are validated again
              </li>
              <li>
                Webhooks are optional; poll
                /api/core/public/invoice/&lt;invoice_id&gt; without auth
              </li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">Base URL</h3>
            <p className="text-ink-soft">The API can be reached from:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>{normalizedSiteUrl}/api/core</li>
            </ul>
          </div>
        </section>

        <section className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="rounded-surface border border-stroke bg-sand/60 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              BTCPay compatibility (WooCommerce)
            </h3>
            <p className="text-ink-soft">
              A Greenfield-compatible subset keeps the official WooCommerce
              plugin working without custodial behavior.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>
                Base URL uses{" "}
                <span className="font-mono text-ink">/api/v1</span>
              </li>
              <li>
                Supported endpoints: stores, invoices, payment methods, webhooks
              </li>
              <li>
                Invoices are defined in XMR; fiat inputs are quote-only metadata
              </li>
              <li>
                Modal checkout is supported; the hosted invoice page is
                recommended for clarity
              </li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke bg-sand/60 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              BTCPay webhooks
            </h3>
            <p className="text-ink-soft">
              Deliveries are signed with the BTCPay header format.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>
                <span className="font-mono text-ink">
                  BTCPay-Sig: sha256=&lt;hmac&gt;
                </span>
              </li>
              <li>Event names follow BTCPay conventions for compatibility.</li>
              <li>
                Destinations must use HTTPS and resolve only to public IP
                addresses.
              </li>
            </ul>
          </div>
        </section>

        <section id="api-reference" className="mt-12 grid scroll-mt-24 gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stroke pb-5">
            <div className="max-w-[52rem]">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-sage"
                  aria-hidden="true"
                />
                Endpoint directory
              </p>
              <h2 className="mt-1 font-sans font-semibold text-2xl">
                API reference
              </h2>
              <p className="text-ink-soft">
                Every endpoint exposed by the API is listed below, grouped by
                access mode.
              </p>
            </div>
            <StatusBadge
              label={`${endpointRequirements.length} documented routes`}
            />
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
                    <div
                      className="h-px w-full bg-monero/70 lg:col-span-2"
                      aria-hidden="true"
                    ></div>
                  ) : null}
                  <details
                    className="overflow-hidden rounded-surface border border-stroke bg-card shadow-soft"
                  >
                    <summary className="cursor-pointer list-none px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay/50 [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="font-sans font-semibold text-xl">
                            {group.title}
                          </h3>
                          <div className="mt-2">
                            <StatusBadge
                              label={`Auth: ${group.auth}`}
                              tone={
                                group.auth === "None" ? "success" : "pending"
                              }
                            />
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-ink-soft">
                          {group.items.length} endpoints
                        </span>
                      </div>
                    </summary>
                    <div className="border-t border-stroke bg-white/50 px-5 pb-5">
                      {group.items.map((endpoint) => {
                        const requirements =
                          requirementsByEndpoint[
                            `${endpoint.method} ${endpoint.path}`
                          ];

                        return (
                          <div
                            className="grid gap-3 border-t border-stroke py-4 first:border-t-0 sm:grid-cols-[auto_1fr] sm:gap-4"
                            key={`${endpoint.method}-${endpoint.path}`}
                          >
                            <span
                              className={`inline-flex h-7 items-center justify-center self-start rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${
                                methodStyles[endpoint.method] ??
                                "bg-ink/10 text-ink-soft"
                              }`}
                            >
                              {endpoint.method}
                            </span>
                            <div className="grid gap-2">
                              <div className="grid gap-1">
                                <span className="break-all font-mono text-sm text-ink">
                                  {endpoint.path}
                                </span>
                                <span className="text-sm text-ink-soft">
                                  {endpoint.description}
                                </span>
                              </div>
                              {requirements ? (
                                <details className="rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm text-ink-soft">
                                  <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.08em] text-ink">
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
                  </details>
                </Fragment>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-surface border border-ink bg-ink px-5 py-4 text-sm text-cream shadow-soft">
            <span className="text-cream/70">
              Need the machine-readable schema?
            </span>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-cream/25 bg-cream/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-cream transition hover:bg-cream/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/60"
              href={`${normalizedSiteUrl}/openapi.json`}
              rel="noreferrer"
              target="_blank"
            >
              OpenAPI JSON
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
