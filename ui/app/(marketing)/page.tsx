import type { Metadata } from "next";
import Link from "next/link";

import { LoginTrigger } from "../../components/login-modal";

export const metadata: Metadata = {
  title: "Home",
};

export default function MarketingHomePage() {
  return (
    <main className="home-page text-ink">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <p className="home-kicker">Monero checkout software</p>
          <h1 id="home-hero-title">
            Accept Monero without giving up wallet control.
          </h1>
          <p className="home-lead">
            Create invoices, show customers where to pay, and detect incoming
            payments with view-only wallet access.
          </p>
          <div className="home-actions" aria-label="Primary actions">
            <Link className="home-button home-button-primary" href="/tour">
              Try the tour
            </Link>
            <LoginTrigger className="home-button home-button-secondary">
              Connect view-only wallet
            </LoginTrigger>
            <Link className="home-doc-link" href="/docs">
              Read the docs
            </Link>
          </div>
          <div className="home-proof-strip" aria-label="Trust boundary summary">
            <span>View-only detection</span>
            <span>No spend keys</span>
            <span>Customer to merchant wallet</span>
          </div>
        </div>

        <div className="checkout-console" aria-label="Checkout preview">
          <div className="console-topbar">
            <span>Checkout preview</span>
            <strong>View-only observer</strong>
          </div>
          <div className="console-grid">
            <section className="console-customer" aria-label="Customer payment view">
              <div className="console-section-header">
                <p>Hosted invoice</p>
                <span>Awaiting funds</span>
              </div>
              <div className="console-amount">
                <strong>0.125000 XMR</strong>
                <span>Network fee is added by the customer wallet.</span>
              </div>
              <div className="console-payment">
                <div className="console-qr" aria-hidden="true"></div>
                <div className="console-address">
                  <span>Payment address</span>
                  <code>48xmr...7f2a</code>
                  <button type="button">Open wallet</button>
                </div>
              </div>
            </section>

            <section className="console-merchant" aria-label="Merchant status view">
              <div className="console-section-header">
                <p>Merchant dashboard</p>
                <span>Payment detected</span>
              </div>
              <div className="console-status-row">
                <div>
                  <strong>1/2</strong>
                  <span>confirmations</span>
                </div>
                <div className="console-progress" aria-hidden="true">
                  <span></span>
                </div>
              </div>
              <div className="console-events">
                <div>
                  <span>invoice.created</span>
                  <strong>subaddress assigned</strong>
                </div>
                <div>
                  <span>invoice.payment_detected</span>
                  <strong>webhook delivered</strong>
                </div>
                <div>
                  <span>invoice.confirmed</span>
                  <strong>waiting for target</strong>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="home-process" aria-labelledby="home-process-title">
        <div>
          <p className="home-kicker">How it works</p>
          <h2 id="home-process-title">A short path from invoice to confirmation.</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Create invoice</h3>
              <p>Set an XMR amount or use an informational fiat reference.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Customer pays</h3>
              <p>The hosted invoice shows the address, QR, and wallet URI.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Payment is detected</h3>
              <p>The software observes the chain using the view key.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Your store updates</h3>
              <p>Poll the API or receive webhook events when the target is reached.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="home-trust" aria-labelledby="home-trust-title">
        <div className="home-trust-copy">
          <p className="home-kicker">Trust boundary</p>
          <h2 id="home-trust-title">Plain permissions, visible states.</h2>
          <p>
            The strongest permission requested is a secret view key. That is
            enough for payment detection and not enough to spend from the wallet.
          </p>
        </div>
        <div className="home-trust-table">
          <div>
            <h3>You provide</h3>
            <p>Primary address, secret view key, confirmation target.</p>
          </div>
          <div>
            <h3>The software can</h3>
            <p>Create invoices, detect incoming payments, relay invoice events.</p>
          </div>
          <div>
            <h3>The software cannot</h3>
            <p>Use spend keys, sign transactions, move funds, or touch bank accounts.</p>
          </div>
        </div>
      </section>

      <section className="home-integration" aria-labelledby="home-integration-title">
        <div>
          <p className="home-kicker">Integrations</p>
          <h2 id="home-integration-title">API and webhooks when you need them.</h2>
          <p>
            Use the hosted invoice page first, then wire status updates into your
            store with the API, webhook events, or BTCPay-compatible endpoints.
          </p>
        </div>
        <div className="integration-lines" aria-label="Example integration events">
          <code>POST /api/core/invoices</code>
          <code>invoice.payment_detected</code>
          <code>invoice.confirmed</code>
        </div>
      </section>
    </main>
  );
}
