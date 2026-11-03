import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InvoiceJourney } from "../../components/invoice-journey";

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
    <main id="main-content" tabIndex={-1} className="home-page text-ink">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <p className="home-kicker">Monero checkout for merchants</p>
          <h1 id="home-hero-title">Accept Monero directly into your wallet.</h1>
          <p className="home-lead">
            Create invoices, share a customer checkout page, and track incoming
            payments and confirmations. Optionally connect your store through APIs and webhooks.
          </p>
          <div className="home-actions" role="group" aria-label="Primary actions">
            <Link className="home-button home-button-primary" href="/tour">
              Explore the demo
            </Link>
            <LoginTrigger className="home-button home-button-secondary">
              Connect view-only wallet
            </LoginTrigger>
          </div>
          <p className="home-entry-note">
            <strong>Exploring the demo?</strong> All payments are simulated. No wallet connection is needed.
          </p>
          <p className="home-entry-note">
            <strong>Ready to accept payments?</strong> Connect your wallet using
            your primary address and private view key. Customer payments go
            directly to your wallet.
          </p>
        </div>

        <InvoiceJourney />
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
          <p>Connect your wallet to this instance to create invoices and share customer checkout pages. A store connection is optional; add API calls or configure webhooks only if you want your store to receive invoice updates.</p>
          <div className="home-actions" role="group" aria-label="Getting started links">
            <LoginTrigger className="home-button home-button-primary">Connect view-only wallet</LoginTrigger>
            <Link className="home-doc-link" href="/guides/monero-payment-api-webhooks">Read the API guide</Link>
          </div>
        </div>
        <div className="home-wallet-table">
          <div><h3>Payment and donation links without programming</h3><p>Sell a product, offer a service, or accept donations of any amount directly to your own wallet. Share a reusable link or paste an HTML button into your website. Each successful submission creates a separate XMR invoice.</p><Link className="home-doc-link" href="/guides/monero-payment-buttons">Set up a payment or donation link</Link></div>
          <div><h3>Prefer your own infrastructure?</h3><p>XMR Checkout is open source and self-hostable. Deploy your own instance before connecting your wallet there.</p><Link className="home-doc-link" href="/guides/self-hosted-monero-checkout">Self-host XMR Checkout</Link></div>
        </div>
      </section>
    </main>
  );
}
