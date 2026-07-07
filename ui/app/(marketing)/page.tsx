import type { Metadata } from "next";
import Link from "next/link";

import { LoginTrigger } from "../../components/login-modal";

export const metadata: Metadata = {
  title: "Home",
};

export default function MarketingHomePage() {
  return (
    <main className="text-ink">
      <section className="px-[6vw] pb-14 pt-10 sm:pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(520px,1.05fr)] lg:grid-rows-[auto_1fr]">
          <div className="grid max-w-[39rem] gap-6 lg:col-start-1 lg:row-start-1">
            <div className="grid gap-4">
              <p className="text-sm font-semibold text-clay">
                For merchants who keep their own wallet
              </p>
              <h1 className="font-serif text-[clamp(2.45rem,2rem+2.5vw,4.2rem)] leading-[1.03]">
                Monero checkout software without handing over control.
              </h1>
              <p className="max-w-[35rem] text-[1.08rem] leading-relaxed text-ink-soft">
                Paste your primary address and secret view key. XMR Checkout
                creates invoices, watches for incoming payments, and reports
                when confirmations reach your target. It cannot spend from your
                wallet.
              </p>
            </div>
          </div>

          <div className="product-preview lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Checkout workflow preview">
            <div className="preview-pane preview-pane--invoice">
              <div className="preview-header">
                <div>
                  <p className="preview-kicker">Customer invoice</p>
                  <h2>Send exact XMR</h2>
                </div>
                <span className="preview-status">Awaiting funds</span>
              </div>
              <div className="preview-amount">
                <span>0.125000 XMR</span>
                <small>Your wallet adds the network fee.</small>
              </div>
              <div className="preview-payment-grid">
                <div className="mock-qr" aria-hidden="true"></div>
                <div className="preview-address">
                  <p>Payment address</p>
                  <code>
                    48xmr...7f2a
                  </code>
                  <div className="preview-actions">
                    <span>Open wallet</span>
                    <span>Copy address</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="preview-pane preview-pane--status">
              <div className="preview-header">
                <div>
                  <p className="preview-kicker">Merchant view</p>
                  <h2>Invoice status</h2>
                </div>
                <span className="preview-status preview-status--detected">
                  Payment detected
                </span>
              </div>
              <div className="preview-confirmations">
                <div>
                  <strong>1/2</strong>
                  <span>confirmations</span>
                </div>
                <div className="preview-progress" aria-hidden="true">
                  <span></span>
                </div>
              </div>
              <div className="preview-event-log">
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
            </div>
          </div>

          <div className="grid max-w-[39rem] gap-6 lg:col-start-1 lg:row-start-2">
            <div className="grid gap-3 text-sm text-ink-soft">
              <div className="flex gap-3">
                <span className="mt-2 h-px w-8 bg-monero" aria-hidden="true"></span>
                <p>
                  Customers pay an invoice address directly from their wallet to yours.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-2 h-px w-8 bg-monero" aria-hidden="true"></span>
                <p>Merchants see pending, detected, and confirmed states clearly.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-2 h-px w-8 bg-monero" aria-hidden="true"></span>
                <p>API and webhooks relay invoice events to your store.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <LoginTrigger className="inline-flex w-full items-center justify-center rounded-full bg-ink px-8 py-4 text-base font-semibold text-cream shadow-[0_18px_34px_rgba(16,18,23,0.2)] transition hover:-translate-y-0.5 sm:w-auto">
                Start with view-only access
              </LoginTrigger>
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-stroke bg-white/60 px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 sm:w-auto"
                href="/tour"
              >
                View the tour
              </Link>
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-stroke bg-white/60 px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 sm:w-auto"
                href="/docs"
              >
                Read docs
              </Link>
            </div>

            <p className="text-sm text-ink-soft">
              Open source and self-hostable.{" "}
              <Link
                className="font-semibold text-ink underline underline-offset-4"
                href="https://github.com/xmrcheckout/xmrcheckout#self-hosted-deployment-docker-compose"
                target="_blank"
                rel="noreferrer"
              >
                Deploy with Docker Compose
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section id="how" className="px-[6vw] py-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="max-w-[34rem]">
            <p className="text-sm font-semibold text-clay">What happens</p>
            <h2 className="mt-3 font-serif text-3xl">
              A checkout flow that stays close to the wallet.
            </h2>
            <p className="mt-3 text-ink-soft">
              The software prepares invoice data, observes the chain with a view
              key, and gives your store clear state changes. The customer still
              sends XMR to your wallet.
            </p>
          </div>
          <ol className="checkout-flow">
            <li>
              <span>01</span>
              <div>
                <h3>Create the invoice</h3>
                <p>Enter an XMR amount or an informational fiat reference.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Customer pays</h3>
                <p>The hosted invoice shows the amount, address, QR, and wallet URI.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Detection starts</h3>
                <p>Incoming payment is detected with view-only wallet access.</p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <h3>Your system is updated</h3>
                <p>Poll the API or receive webhook events when the target is reached.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section id="trust" className="px-[6vw] py-14">
        <div className="trust-boundary">
          <div>
            <p className="text-sm font-semibold text-clay">Trust boundary</p>
            <h2 className="mt-3 font-serif text-3xl">Plain by design.</h2>
            <p className="mt-3 text-ink-soft">
              XMR Checkout should be boring in the places that matter: permissions,
              payment state, and failure behavior.
            </p>
          </div>
          <div className="trust-boundary-grid">
            <div>
              <h3>You provide</h3>
              <ul>
                <li>Primary address</li>
                <li>Secret view key</li>
                <li>Confirmation target</li>
                <li>Webhook URL, if needed</li>
              </ul>
            </div>
            <div>
              <h3>The software can</h3>
              <ul>
                <li>Create invoices and subaddresses</li>
                <li>Detect incoming payments</li>
                <li>Show confirmation progress</li>
                <li>Relay invoice events</li>
              </ul>
            </div>
            <div>
              <h3>The software cannot</h3>
              <ul>
                <li>Use spend keys</li>
                <li>Sign transactions</li>
                <li>Move or pool funds</li>
                <li>Touch bank accounts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="cta" className="px-[6vw] pb-24 pt-10">
        <div className="grid gap-5 rounded-2xl bg-ink p-8 text-cream shadow-deep sm:p-10">
          <h2 className="font-serif text-3xl">Try the checkout flow.</h2>
          <p className="max-w-[42rem] text-cream/80">
            Use the tour with simulated data, or sign in with view-only wallet
            access when you are ready to create an invoice.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center justify-center rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream transition hover:-translate-y-0.5"
              href="/tour"
            >
              Take the tour
            </Link>
            <LoginTrigger className="inline-flex items-center justify-center rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream transition hover:-translate-y-0.5">
              Sign in
            </LoginTrigger>
            <Link
              className="inline-flex items-center justify-center rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream transition hover:-translate-y-0.5"
              href="/docs"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
