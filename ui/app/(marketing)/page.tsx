import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginTrigger } from "../../components/login-modal";

export const metadata: Metadata = {
  title: {
    absolute: "Accept Monero Directly into Your Wallet | XMR Checkout",
  },
  description:
    "Create invoices, share customer checkout pages, and track Monero payments directly to your wallet. Open-source, self-hostable software with APIs and webhooks.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "XMR Checkout",
    title: "Accept Monero Directly into Your Wallet | XMR Checkout",
    description:
      "Create invoices, share customer checkout pages, and track Monero payments directly to your wallet. Open-source, self-hostable software with APIs and webhooks.",
  },
};

const exampleJourney = [
  { role: "Merchant", title: "Create an invoice", detail: "Set amount + confirmation target" },
  { role: "Customer", title: "Open checkout", detail: "Review amount + pay wallet" },
  { role: "Merchant", title: "Payment detected", detail: "Incoming XMR is found" },
  { role: "Merchant", title: "Target reached", detail: "Required confirmations complete" },
  { role: "Integration", title: "Store notified", detail: "Configured webhook reports invoice" },
];

function FlowIcon({ role }: { role: string }) {
  if (role === "Customer") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3" /><path d="M5 21c.6-4 2.9-6 7-6s6.4 2 7 6" /></svg>;
  }
  if (role === "Integration") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h3m2 0h5M7 16h10" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11" /><path d="M8 20v-6h8v6M2 20h20" /></svg>;
}

export default async function MarketingHomePage({
  searchParams,
}: {
  searchParams: Promise<{ donate?: string | string[] }>;
}) {
  const query = await searchParams;
  if (query.donate === "1") {
    redirect("/donate");
  }

  return (
    <main className="home-page text-ink">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <p className="home-kicker">Monero checkout for merchants</p>
          <h1 id="home-hero-title">Accept Monero directly into your wallet.</h1>
          <p className="home-lead">
            Create invoices, share a customer checkout page, and track incoming
            payments and confirmations. Connect your store through APIs and webhooks.
          </p>
          <div className="home-actions" aria-label="Primary actions">
            <Link className="home-button home-button-primary" href="/tour">
              Explore the demo
            </Link>
            <LoginTrigger className="home-button home-button-secondary">
              Connect view-only wallet
            </LoginTrigger>
          </div>
          <p className="home-entry-note">Simulated payments. No wallet required for the demo.</p>
          <p className="home-entry-note">
            Connect your wallet using your primary address and
            private view key. Payments go directly to your wallet.
          </p>
        </div>

        <div className="checkout-console" aria-labelledby="example-journey-title">
          <div className="console-topbar">
            <h2 id="example-journey-title">Example invoice journey — simulated</h2>
          </div>
          <div className="home-circular-flow" aria-label="Circular flow between merchant, customer, and store">
            <svg className="home-flow-connectors" viewBox="0 0 480 300" aria-hidden="true">
              <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
              <path d="M140 92 C180 32 300 32 340 92" />
              <path d="M370 130 C410 195 340 260 290 270" />
              <path d="M190 270 C140 260 70 195 110 130" />
            </svg>
            <div className="home-flow-center"><strong>XMR</strong><span>checkout</span></div>
            <div className="home-flow-node home-flow-node-merchant"><span className="home-flow-step">1</span><span className="home-flow-icon"><FlowIcon role="Merchant" /></span><strong>Merchant</strong><small>creates invoice</small></div>
            <div className="home-flow-node home-flow-node-customer"><span className="home-flow-step">2</span><span className="home-flow-icon"><FlowIcon role="Customer" /></span><strong>Customer</strong><small>pays wallet</small></div>
            <div className="home-flow-node home-flow-node-store"><span className="home-flow-step">3</span><span className="home-flow-icon"><FlowIcon role="Integration" /></span><strong>Store</strong><small>gets update</small></div>
          </div>
          <ol className="home-journey">
            {exampleJourney.map((step, index) => (
              <li key={step.title} data-role={step.role.toLowerCase()}>
                <span aria-hidden="true">0{index + 1}</span>
                <div>
                  <div className="home-journey-meta"><span>{step.role}</span><span aria-hidden="true">{index < exampleJourney.length - 1 ? "→" : "✓"}</span></div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="home-journey-note">Store notifications require integration. No payment is requested in this example.</p>
        </div>
      </section>

      <section className="home-process" aria-labelledby="home-process-title">
        <div>
          <p className="home-kicker">Customer checkout</p>
          <h2 id="home-process-title">Give customers a clear way to pay.</h2>
        </div>
        <ol>
          <li><span>01</span><div><h3>Create and share an invoice</h3><p>Set the amount in XMR and share the customer checkout page.</p></div></li>
          <li><span>02</span><div><h3>Give customers the payment details</h3><p>The page shows the exact amount, wallet address, QR code, and a link to open a wallet. Network fees are separate.</p></div></li>
          <li><span>03</span><div><h3>Show confirmation progress</h3><p>Customers can follow payment detection and progress toward your confirmation target.</p></div></li>
        </ol>
      </section>

      <section className="home-wallet" aria-labelledby="home-wallet-title">
        <div className="home-wallet-copy">
          <p className="home-kicker">Wallet access</p>
          <h2 id="home-wallet-title">Track payments. Keep control of your wallet.</h2>
          <p>Payments go directly from the customer to your Monero wallet. XMR Checkout observes incoming payments; the software cannot spend your funds.</p>
        </div>
        <div className="home-wallet-table">
          <div><h3>Your wallet receives the XMR</h3><p>Use the wallet you already control.</p></div>
          <div><h3>View-only access</h3><p>Your primary address and private view key enable incoming payment detection. Never submit a spend key or recovery seed.</p></div>
          <div><h3>Your confirmation target</h3><p>Choose how many confirmations an invoice requires. Payment detection and reaching that target are separate states.</p></div>
        </div>
      </section>

      <section className="home-integration" aria-labelledby="home-integration-title">
        <div>
          <p className="home-kicker">Getting started</p>
          <h2 id="home-integration-title">Start here. Integrate when you’re ready.</h2>
          <p>Connect your wallet to this instance to create invoices and share customer checkout pages. Add API calls or configure webhooks when you want your store to receive invoice updates.</p>
          <div className="home-actions" aria-label="Getting started links">
            <LoginTrigger className="home-button home-button-primary">Connect view-only wallet</LoginTrigger>
            <Link className="home-doc-link" href="/guides/monero-payment-api-webhooks">Read the API guide</Link>
          </div>
        </div>
        <div className="home-wallet-table">
          <div><h3>Prefer your own infrastructure?</h3><p>XMR Checkout is open source and self-hostable. Deploy your own instance before connecting your wallet there.</p><Link className="home-doc-link" href="/guides/self-hosted-monero-checkout">Self-host XMR Checkout</Link></div>
        </div>
      </section>
    </main>
  );
}
