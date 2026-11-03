import type { Metadata } from "next";
import Link from "next/link";

import PageIntroBand from "../../../components/page-intro-band";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Practical guides for adding Monero payment and donation links, running self-hosted XMR Checkout, and integrating invoices and webhooks.",
  alternates: {
    canonical: "/guides",
  },
  openGraph: {
    type: "website",
    url: "/guides",
    siteName: "XMR Checkout",
    title: "Monero Checkout Guides | XMR Checkout",
    description:
      "Practical guides for adding Monero payment and donation links, running self-hosted XMR Checkout, and integrating invoices and webhooks.",
  },
  twitter: {
    card: "summary",
    title: "Monero Checkout Guides | XMR Checkout",
    description:
      "Practical guides for adding Monero payment and donation links, running self-hosted XMR Checkout, and integrating invoices and webhooks.",
  },
};

const cardClass =
  "group rounded-surface border border-stroke bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-ink/30 sm:p-7";

export default function GuidesPage() {
  return (
    <main id="main-content" tabIndex={-1} className="reference-page px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-7xl">
        <PageIntroBand
          eyebrow="Guides"
          id="guides-title"
          title="Run your checkout with a clear path from setup to integration."
          description={
            <p>
              Start with the guide that matches your role. All follow the same
              non-custodial model: your wallet receives XMR, while XMR Checkout
              observes incoming payments and reports invoice status.
            </p>
          }
        />

        <section className="mt-8 grid gap-5 md:grid-cols-2" aria-label="Guides">
          <Link className={cardClass} href="/guides/monero-payment-buttons">
            <p className="text-sm font-semibold text-ink-soft">For websites, creators, and freelancers</p>
            <h2 className="mt-2 font-sans text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">Accept Monero with payment and donation links</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">Accept payments or donations to your own wallet. Copy HTML or share a reusable URL, and track a separate invoice for each submission.</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-ink">Read the payment button guide →</span>
          </Link>
          <Link className={cardClass} href="/guides/in-person-monero-checkout">
            <p className="text-sm font-semibold text-ink-soft">For cafés, market stalls, and shops</p>
            <h2 className="mt-2 font-sans text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">Accept Monero in person with a terminal</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">Turn a tablet or phone into a till. Type the amount, show a QR code, and see the payment arrive in seconds.</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-ink">Read the terminal guide →</span>
          </Link>
          <Link className={cardClass} href="/guides/self-hosted-monero-checkout">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-clay" aria-hidden="true" />
              For operators
            </p>
            <h2 className="mt-2 font-sans text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">
              How to run a self-hosted Monero checkout
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Configure Docker Compose, a view-only wallet, a Monero daemon,
              and the first invoice detection checks.
            </p>
            <span className="mt-5 inline-flex text-sm font-semibold text-ink">
              Read the self-hosting guide →
            </span>
          </Link>

          <Link className={cardClass} href="/guides/monero-payment-api-webhooks">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-sage" aria-hidden="true" />
              For developers
            </p>
            <h2 className="mt-2 font-sans text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">
              Integrating the Monero payment API and webhooks
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Connect your order flow to invoice creation, hosted payment pages,
              public status checks, and webhook events.
            </p>
            <span className="mt-5 inline-flex text-sm font-semibold text-ink">
              Read the API integration guide →
            </span>
          </Link>
        </section>

        <aside className="mt-8 rounded-surface border border-ink bg-ink px-6 py-6 text-cream shadow-card sm:px-8">
          <p className="text-sm font-semibold text-cream/60">Need the reference?</p>
          <h2 className="mt-1 font-sans text-2xl font-semibold">
            Browse the complete documentation.
          </h2>
          <p className="mt-2 max-w-2xl text-cream/70">
            Use the API reference and integration recipes when you are ready to
            copy endpoint details or language-specific examples.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-cream bg-cream px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              href="/docs"
            >
              API documentation
            </Link>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-cream/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-cream transition hover:border-cream hover:bg-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              href="/docs/integrations"
            >
              Integration recipes
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
