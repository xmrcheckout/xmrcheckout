import type { Metadata } from "next";
import Link from "next/link";

import PageIntroBand from "../../../../components/page-intro-band";

export const metadata: Metadata = {
  title: "How to Run a Self-Hosted Monero Checkout",
  description:
    "Set up XMR Checkout with Docker Compose, a view-only wallet, a Monero daemon, and reliable invoice detection.",
  alternates: {
    canonical: "/guides/self-hosted-monero-checkout",
  },
  openGraph: {
    type: "article",
    url: "/guides/self-hosted-monero-checkout",
    siteName: "XMR Checkout",
    title: "How to Run a Self-Hosted Monero Checkout | XMR Checkout",
    description:
      "Set up XMR Checkout with Docker Compose, a view-only wallet, a Monero daemon, and reliable invoice detection.",
  },
  twitter: {
    card: "summary",
    title: "How to Run a Self-Hosted Monero Checkout | XMR Checkout",
    description:
      "Set up XMR Checkout with Docker Compose, a view-only wallet, a Monero daemon, and reliable invoice detection.",
  },
};

const sectionClass =
  "scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-8";
const codeClass =
  "mt-4 overflow-x-auto rounded-surface border border-ink bg-ink px-5 py-4 text-xs leading-relaxed text-cream shadow-soft";

const sections = [
  ["#architecture", "Understand the flow"],
  ["#requirements", "Prepare the host"],
  ["#docker", "Deploy with Docker"],
  ["#verify", "Verify detection"],
  ["#troubleshooting", "Troubleshoot"],
] as const;

export default function SelfHostedGuidePage() {
  return (
    <main className="px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-5xl">
        <PageIntroBand
          eyebrow="Guide · Self-hosting"
          id="self-hosted-guide-title"
          title="How to run a self-hosted Monero checkout."
          description={
            <p>
              This guide covers the deployment path for operators who want XMR
              Checkout running alongside infrastructure they control. It uses
              only a wallet address and private view key for payment detection.
            </p>
          }
        />

        <nav
          className="mt-6 grid gap-1.5 rounded-surface border border-stroke bg-card p-2 shadow-soft sm:grid-cols-2"
          aria-label="Self-hosting guide sections"
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

        <div className="mt-8 grid gap-6">
          <section className={sectionClass} id="architecture" aria-labelledby="architecture-title">
            <p className="text-sm font-semibold text-clay">01 · Understand the flow</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="architecture-title">
              Customer to merchant wallet, with status reported by software.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              Your store or dashboard creates an invoice. The hosted invoice
              page shows the amount, address, QR code, and wallet URI. A
              reconciler checks the configured wallet and Monero daemon for an
              incoming payment, then updates invoice status for your dashboard,
              API, and webhooks.
            </p>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Create", "Make an XMR invoice from the dashboard or API."],
                ["02", "Observe", "Watch the merchant wallet for the expected payment."],
                ["03", "Report", "Read status through the UI, API, or webhooks."],
              ].map(([number, title, description]) => (
                <li className="rounded-2xl border border-stroke bg-white/60 p-4" key={number}>
                  <span className="font-mono text-xs text-ink-soft">{number}</span>
                  <h3 className="mt-2 font-sans font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={sectionClass} id="requirements" aria-labelledby="requirements-title">
            <p className="text-sm font-semibold text-clay">02 · Prepare the host</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="requirements-title">
              Gather the configuration before starting the stack.
            </h2>
            <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-ink-soft sm:grid-cols-2">
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                A host that can run Docker Compose and persist Postgres and
                wallet data.
              </li>
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                A public HTTPS site URL for hosted invoice pages and webhook
                destinations.
              </li>
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                A Monero primary address and private view key. Never provide a
                private spend key.
              </li>
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                A reachable Monero daemon and wallet-rpc target, either bundled
                or external.
              </li>
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-ink-soft">
              The full environment variable reference and deployment notes are
              maintained in the repository README. Review them before exposing
              an installation to the public internet.
            </p>
            <Link
              className="mt-4 inline-flex text-sm font-semibold text-ink underline decoration-clay underline-offset-4"
              href="https://github.com/xmrcheckout/xmrcheckout#self-hosted-deployment-docker-compose"
              target="_blank"
              rel="noreferrer"
            >
              Read the Docker Compose deployment reference →
            </Link>
          </section>

          <section className={sectionClass} id="docker" aria-labelledby="docker-title">
            <p className="text-sm font-semibold text-clay">03 · Deploy with Docker</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="docker-title">
              Start from the example environment and choose your node path.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              Copy the environment template, set the database and API values,
              configure the site URL, and add the view-only wallet settings.
              Then choose whether the reconciler should use a third-party daemon
              or a local daemon started by the Compose profile.
            </p>
            <pre className={codeClass}>
              <code>{`cp .env.example .env
docker compose up --build -d

# If you are running the bundled Monero daemon:
docker compose --profile local-daemon up --build -d`}</code>
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              A local daemon must finish syncing before payment detection is
              reliable. If you use the bundled wallet-rpc shards, keep their
              configured URL ordering stable because it determines shard
              ownership for view-only wallets.
            </p>
          </section>

          <section className={sectionClass} id="verify" aria-labelledby="verify-title">
            <p className="text-sm font-semibold text-sage">04 · Verify detection</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="verify-title">
              Test one invoice before connecting a store.
            </h2>
            <ol className="mt-4 grid gap-3 text-sm leading-relaxed text-ink-soft">
              <li className="flex gap-3 rounded-2xl border border-stroke bg-white/60 p-4">
                <span className="font-mono text-xs text-ink-soft">01</span>
                Open the dashboard and create a small test invoice in XMR.
              </li>
              <li className="flex gap-3 rounded-2xl border border-stroke bg-white/60 p-4">
                <span className="font-mono text-xs text-ink-soft">02</span>
                Open the hosted invoice page and confirm that its address, amount,
                QR code, and expiry are visible.
              </li>
              <li className="flex gap-3 rounded-2xl border border-stroke bg-white/60 p-4">
                <span className="font-mono text-xs text-ink-soft">03</span>
                Send the test payment from a wallet you control and wait for the
                configured confirmation target.
              </li>
              <li className="flex gap-3 rounded-2xl border border-stroke bg-white/60 p-4">
                <span className="font-mono text-xs text-ink-soft">04</span>
                Confirm that the dashboard and public invoice page show the
                observed status before adding webhooks or order automation.
              </li>
            </ol>
          </section>

          <section className={sectionClass} id="troubleshooting" aria-labelledby="troubleshooting-title">
            <p className="text-sm font-semibold text-sage">05 · Troubleshoot safely</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="troubleshooting-title">
              Check the observation path in order.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              If an invoice remains at zero confirmations, check wallet-rpc
              reachability, daemon connectivity, current daemon height, and the
              time of the last successful reconcile. Inspect the API,
              reconciler, wallet-rpc, and daemon logs before changing wallet
              configuration.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              The service only observes payments. If the UI or reconciler is
              unavailable, a valid on-chain payment still goes from the
              customer to your wallet; status updates may be delayed until the
              service is available again.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                href="/faq#operations"
              >
                Operations FAQ
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                href="/tour"
              >
                Explore the interactive tour
              </Link>
            </div>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-stroke pt-6 text-sm text-ink-soft">
          <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides">
            Back to all guides
          </Link>
          <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/monero-payment-api-webhooks">
            Continue to API and webhook integration →
          </Link>
        </footer>
      </div>
    </main>
  );
}
