import type { Metadata } from "next";
import Link from "next/link";

import PageIntroBand from "../../../../components/page-intro-band";

export const metadata: Metadata = {
  title: "Integrating the Monero Payment API and Webhooks",
  description:
    "Connect a store to XMR Checkout with invoice creation, hosted payment pages, public status checks, and webhook events.",
  alternates: {
    canonical: "/guides/monero-payment-api-webhooks",
  },
  openGraph: {
    type: "article",
    url: "/guides/monero-payment-api-webhooks",
    siteName: "XMR Checkout",
    title: "Integrating the Monero Payment API and Webhooks | XMR Checkout",
    description:
      "Connect a store to XMR Checkout with invoice creation, hosted payment pages, public status checks, and webhook events.",
  },
  twitter: {
    card: "summary",
    title: "Integrating the Monero Payment API and Webhooks | XMR Checkout",
    description:
      "Connect a store to XMR Checkout with invoice creation, hosted payment pages, public status checks, and webhook events.",
  },
};

const sectionClass =
  "min-w-0 scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-8";
const codeClass =
  "mt-4 overflow-x-auto rounded-surface border border-ink bg-ink px-5 py-4 text-xs leading-relaxed text-cream shadow-soft";

const sections = [
  ["#flow", "Use the request flow"],
  ["#create", "Create an invoice"],
  ["#status", "Read status"],
  ["#webhooks", "Receive webhooks"],
  ["#security", "Keep integration safe"],
] as const;

export default function ApiWebhookGuidePage() {
  return (
    <main className="reference-page px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-5xl">
        <PageIntroBand
          eyebrow="Guide · API and webhooks"
          id="api-webhook-guide-title"
          title="Integrating the Monero payment API and webhooks."
          description={
            <p>
              Connect an existing order flow to invoice creation, the hosted
              payment page, public status checks, and webhook events without
              exposing credentials in browser code.
            </p>
          }
        />

        <nav
          className="mt-6 grid gap-1.5 rounded-surface border border-stroke bg-card p-2 shadow-soft sm:grid-cols-2"
          aria-label="API integration guide sections"
        >
          {sections.map(([href, label], index) => (
            <a
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-stroke hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
              href={href}
              key={href}
            >
              <span className="font-mono text-xs text-ink-soft/60">0{index + 1}</span>
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-8 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          <section className={sectionClass} id="flow" aria-labelledby="flow-title">
            <p className="text-sm font-semibold text-clay">01 · Use the request flow</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="flow-title">
              Create, redirect, observe, and update your order.
            </h2>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["01", "Create an invoice", "Call the authenticated invoice endpoint with an XMR amount and your order metadata."],
                ["02", "Send the customer to checkout", "Use the returned invoice URL for the hosted payment page."],
                ["03", "Observe status", "Poll the public invoice endpoint or receive the relevant webhook event."],
                ["04", "Update your order", "Use invoice.confirmed as the confirmation signal for your own order flow."],
              ].map(([number, title, description]) => (
                <li className="rounded-2xl border border-stroke bg-white/60 p-4" key={number}>
                  <span className="font-mono text-xs text-ink-soft">{number}</span>
                  <h3 className="mt-2 font-sans font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={sectionClass} id="create" aria-labelledby="create-title">
            <p className="text-sm font-semibold text-clay">02 · Create an invoice</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="create-title">
              Keep the API call on your server.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              Authenticated endpoints use an API key. Send the amount in XMR,
              choose a confirmation target when needed, and include an internal
              order reference in metadata so your webhook handler can connect
              an event to your order.
            </p>
            <pre className={codeClass}>
              <code>{`curl -sS -X POST "$XMRCHECKOUT_API_BASE_URL/invoices" \\\n  -H "Authorization: ApiKey $XMRCHECKOUT_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "amount_xmr": "0.125",\n    "confirmation_target": 2,\n    "metadata": { "order_id": "ORDER-1234" }\n  }'`}</code>
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              The response contains the invoice id, payment details, and
              hosted invoice URL. Store the invoice id with your order and
              redirect the customer to that URL.
            </p>
          </section>

          <section className={sectionClass} id="status" aria-labelledby="status-title">
            <p className="text-sm font-semibold text-sage">03 · Read status</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="status-title">
              Use the public invoice endpoint for a simple fallback.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              The public endpoint does not need an API key and returns the
              invoice status and payment details. Use it for customer-facing
              refreshes or as a polling fallback while your server waits for a
              webhook.
            </p>
            <pre className={codeClass}>
              <code>{`curl -sS "$XMRCHECKOUT_API_BASE_URL/public/invoice/$INVOICE_ID"`}</code>
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Treat the confirmation target as part of your order policy. A
              detected payment and a confirmed invoice are different states;
              your order flow should use the state that matches what you need.
            </p>
          </section>

          <section className={sectionClass} id="webhooks" aria-labelledby="webhooks-title">
            <p className="text-sm font-semibold text-sage">04 · Receive webhooks</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="webhooks-title">
              Subscribe to the events your server needs.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              Register a public HTTPS endpoint through the dashboard or the API,
              then select the events you want to receive. Native events include{" "}
              <span className="font-mono text-ink">invoice.created</span>,{" "}
              <span className="font-mono text-ink">invoice.payment_detected</span>,{" "}
              <span className="font-mono text-ink">invoice.confirmed</span>, and{" "}
              <span className="font-mono text-ink">invoice.expired</span>.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-stroke bg-white/60 p-4">
                <h3 className="font-sans font-semibold">Verify the header</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Compare the <span className="font-mono text-ink">X-Webhook-Secret</span>{" "}
                  header with the secret stored by your server before processing
                  the JSON payload.
                </p>
              </div>
              <div className="rounded-2xl border border-stroke bg-white/60 p-4">
                <h3 className="font-sans font-semibold">Acknowledge clearly</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Return a successful HTTP response only after your handler has
                  safely recorded the event for its own processing.
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-ink-soft">
              Failed deliveries are recorded in webhook history and can be
              redelivered from the API. Make your handler safe to run more than
              once by keying order updates on the invoice id and event state.
            </p>
          </section>

          <section className={sectionClass} id="security" aria-labelledby="security-title">
            <p className="text-sm font-semibold text-clay">05 · Keep integration safe</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="security-title">
              Separate customer-facing pages from server credentials.
            </h2>
            <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-ink-soft">
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                Keep API keys and webhook secrets in server-side environment
                variables. Do not ship them in browser JavaScript.
              </li>
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                Use HTTPS for webhook destinations and validate the secret before
                acting on an event.
              </li>
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                Your integration observes invoice status; it does not request
                spend authority or move funds.
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-cream transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                href="/docs"
              >
                Open API reference
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                href="/docs/integrations"
              >
                See language recipes
              </Link>
            </div>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-stroke pt-6 text-sm text-ink-soft">
          <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides">
            Back to all guides
          </Link>
          <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/self-hosted-monero-checkout">
            Read the self-hosting guide →
          </Link>
        </footer>
      </div>
    </main>
  );
}
