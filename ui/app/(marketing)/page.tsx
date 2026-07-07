import type { Metadata } from "next";
import Link from "next/link";

import { LoginTrigger } from "../../components/login-modal";

export const metadata: Metadata = {
  title: "Home",
};

const previewQrModules = [
  [10, 1],
  [12, 1],
  [15, 1],
  [18, 1],
  [9, 2],
  [11, 2],
  [14, 2],
  [17, 2],
  [19, 2],
  [10, 3],
  [13, 3],
  [15, 3],
  [18, 3],
  [9, 4],
  [12, 4],
  [16, 4],
  [19, 4],
  [10, 5],
  [14, 5],
  [17, 5],
  [9, 6],
  [11, 6],
  [15, 6],
  [18, 6],
  [1, 10],
  [3, 10],
  [5, 10],
  [8, 10],
  [11, 10],
  [13, 10],
  [16, 10],
  [20, 10],
  [23, 10],
  [26, 10],
  [2, 11],
  [6, 11],
  [9, 11],
  [12, 11],
  [15, 11],
  [18, 11],
  [21, 11],
  [25, 11],
  [1, 12],
  [4, 12],
  [7, 12],
  [10, 12],
  [14, 12],
  [17, 12],
  [20, 12],
  [24, 12],
  [27, 12],
  [3, 13],
  [6, 13],
  [8, 13],
  [11, 13],
  [13, 13],
  [16, 13],
  [19, 13],
  [22, 13],
  [25, 13],
  [2, 14],
  [5, 14],
  [9, 14],
  [12, 14],
  [15, 14],
  [18, 14],
  [21, 14],
  [24, 14],
  [27, 14],
  [1, 15],
  [4, 15],
  [7, 15],
  [10, 15],
  [13, 15],
  [17, 15],
  [20, 15],
  [23, 15],
  [26, 15],
  [2, 16],
  [5, 16],
  [8, 16],
  [11, 16],
  [14, 16],
  [18, 16],
  [21, 16],
  [25, 16],
  [3, 17],
  [6, 17],
  [9, 17],
  [12, 17],
  [16, 17],
  [19, 17],
  [22, 17],
  [27, 17],
  [1, 18],
  [5, 18],
  [8, 18],
  [11, 18],
  [15, 18],
  [18, 18],
  [21, 18],
  [24, 18],
  [26, 18],
  [10, 20],
  [13, 20],
  [16, 20],
  [19, 20],
  [9, 21],
  [12, 21],
  [15, 21],
  [18, 21],
  [10, 22],
  [14, 22],
  [17, 22],
  [20, 22],
  [9, 23],
  [11, 23],
  [15, 23],
  [19, 23],
  [10, 24],
  [13, 24],
  [16, 24],
  [18, 24],
  [9, 25],
  [12, 25],
  [15, 25],
  [20, 25],
] as const;

function FinderPattern({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="7" height="7" rx="0.5" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#ffffff" rx="0.35" />
      <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.2" />
    </g>
  );
}

function PreviewQr() {
  return (
    <div className="console-qr" aria-hidden="true">
      <svg viewBox="0 0 29 29" focusable="false">
        <rect width="29" height="29" fill="#ffffff" />
        <FinderPattern x={1} y={1} />
        <FinderPattern x={21} y={1} />
        <FinderPattern x={1} y={21} />
        {previewQrModules.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" rx="0.08" />
        ))}
      </svg>
    </div>
  );
}

export default function MarketingHomePage() {
  return (
    <main className="home-page text-ink">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <p className="home-kicker">Monero checkout for merchants</p>
          <h1 id="home-hero-title">Accept Monero with your own wallet.</h1>
          <p className="home-lead">
            Create a payment request, let the customer pay your wallet, and get
            a clear update when incoming XMR is detected.
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
            <span>View key only</span>
            <span>No spend authority</span>
            <span>Customer pays your wallet</span>
          </div>
        </div>

        <div className="checkout-console" aria-label="Checkout preview">
          <div className="console-topbar">
            <span>Payment request preview</span>
            <strong>View key only</strong>
          </div>
          <div className="console-grid">
            <section className="console-customer" aria-label="Customer payment view">
              <div className="console-section-header">
                <p>Invoice 9F2A-18</p>
                <span>Awaiting funds</span>
              </div>
              <div className="console-amount">
                <strong>0.125000 XMR</strong>
                <span>Due before 14:30 UTC. Wallet fee is separate.</span>
              </div>
              <div className="console-payment">
                <PreviewQr />
                <div className="console-address">
                  <span>Your wallet address</span>
                  <code>48xmr...7f2a</code>
                  <button type="button">Open wallet</button>
                </div>
              </div>
            </section>

            <section className="console-merchant" aria-label="Merchant status view">
              <div className="console-section-header">
                <p>Store status</p>
                <span>Detected</span>
              </div>
              <div className="console-status-row">
                <div>
                  <strong>1 / 2</strong>
                  <span>confirmations</span>
                </div>
                <div className="console-progress" aria-hidden="true">
                  <span></span>
                </div>
              </div>
              <div className="console-events">
                <div>
                  <span>Last checked</span>
                  <strong>18:22 UTC</strong>
                </div>
                <div>
                  <span>invoice.payment_detected</span>
                  <strong>sent to store</strong>
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
          <p className="home-kicker">Merchant flow</p>
          <h2 id="home-process-title">From payment request to detected XMR.</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Create a payment request</h3>
              <p>Enter the XMR amount, optional reference, and confirmation target.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Customer pays your wallet</h3>
              <p>The hosted page shows the exact amount, address, QR, and wallet URI.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>XMR is detected</h3>
              <p>The software watches the chain with view-only wallet access.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Your store updates</h3>
              <p>Use polling or webhooks when the confirmation target is reached.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="home-trust" aria-labelledby="home-trust-title">
        <div className="home-trust-copy">
          <p className="home-kicker">Trust boundary</p>
          <h2 id="home-trust-title">What the software can and cannot do.</h2>
          <p>
            XMR Checkout only needs the permissions required to see incoming
            payments. A view key can help detect payments; it cannot spend from
            your wallet.
          </p>
        </div>
        <div className="home-trust-table">
          <div>
            <h3>You provide</h3>
            <p>Primary address, secret view key, confirmation target, optional webhook URL.</p>
          </div>
          <div>
            <h3>The software can</h3>
            <p>Create payment requests, assign subaddresses, detect incoming payments, relay status events.</p>
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
          <h2 id="home-integration-title">Connect your store when you are ready.</h2>
          <p>
            Start with the hosted payment page. Add API calls, webhook events,
            or BTCPay-compatible routes after the checkout flow is working.
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
