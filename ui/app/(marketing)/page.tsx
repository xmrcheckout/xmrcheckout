import type { Metadata } from "next";
import Link from "next/link";

import { LoginTrigger } from "../../components/login-modal";

export const metadata: Metadata = {
  title: "Home",
};

export default function MarketingHomePage() {
  return (
    <main className="text-ink">
      <section className="relative overflow-hidden px-[6vw] pb-16 pt-10 sm:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid max-w-[38rem] gap-6 animate-[rise_0.9s_ease_both]">
            <h1 className="font-serif text-[clamp(2.6rem,2.2rem+2.3vw,4.3rem)] leading-[1.02]">
              Monero checkout software with view-only detection and merchant-owned custody.
            </h1>
            <p className="text-[1.08rem] leading-relaxed text-ink-soft">
              Create invoices, detect on-chain payments using your primary address and secret view key,
              and relay status to your systems - without ever holding or moving funds.
            </p>
            <ul className="grid gap-3 text-sm text-ink-soft">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-monero"></span>
                <span>
                  View-only detection using your primary address and secret view key.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-monero"></span>
                <span>
                  No account or email required - your primary address is the identifier.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-monero"></span>
                <span>BTCPay-compatible invoice endpoints for existing integrations.</span>
              </li>
            </ul>
            <p className="inline-flex w-fit items-center rounded-full bg-monero px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink shadow-[0_12px_24px_rgba(242,104,34,0.25)]">
              Non-custodial · view-only access · merchant-owned funds
            </p>
            <p className="text-sm font-semibold text-ink-soft">
              Open source. Self-hostable.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                className="inline-flex w-full items-center justify-center rounded-full bg-ink px-8 py-4 text-base font-semibold text-cream shadow-[0_18px_34px_rgba(16,18,23,0.2)] transition hover:-translate-y-0.5 sm:w-auto"
                href="/login"
              >
                Log in
              </Link>
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-stroke bg-white/60 px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 sm:w-auto"
                href="/docs"
              >
                View documentation
              </Link>
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-stroke bg-white/60 px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 sm:w-auto"
                href="https://github.com/xmrcheckout/xmrcheckout#self-hosted-deployment-docker-compose"
                target="_blank"
                rel="noreferrer"
              >
                Self-host
              </Link>
            </div>
          </div>
          <div className="relative grid gap-4">
            <div className="absolute -left-6 top-4 hidden h-[calc(100%-2rem)] w-px bg-gradient-to-b from-monero/0 via-monero/60 to-monero/0 lg:block"></div>
            <div className="rounded-3xl border border-stroke bg-card p-7 shadow-card backdrop-blur animate-[rise_1s_ease_both] [animation-delay:150ms]">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-monero/15 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-monero">
                  Detection
                </span>
                <span className="text-sm font-semibold text-sage">
                  View-only
                </span>
              </div>
              <div className="mt-6 grid gap-4">
                <p className="text-2xl font-semibold">
                  Detection timeline
                </p>
                <div className="relative grid gap-3 pl-6 text-sm text-ink-soft">
                  <span className="timeline-rail" aria-hidden="true"></span>
                  <span className="timeline-scan" aria-hidden="true"></span>
                  <div className="flex items-center gap-3">
                    <span className="timeline-dot is-active h-2.5 w-2.5 rounded-full bg-monero"></span>
                    <span className="font-semibold text-ink">
                      Detected
                    </span>
                    <span className="text-ink-soft">Seen on the network (unconfirmed)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-monero/60"></span>
                    <span className="font-semibold text-ink">
                      Confirming
                    </span>
                    <span className="text-ink-soft">
                      Waiting for confirmations
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-ink/20"></span>
                    <span className="font-semibold text-ink">
                      Confirmed
                    </span>
                    <span className="text-ink-soft">Target reached</span>
                  </div>
                </div>
                <p className="text-sm text-ink-soft">
                  We observe confirmations without touching funds or keys.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="rounded-2xl border border-stroke bg-white/70 p-4 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both] [animation-delay:260ms] sm:p-5">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft sm:text-[0.75rem]">
                  View-only
                </p>
                <h3 className="mt-2 font-serif text-base sm:text-xl">
                  Access ends at detection.
                </h3>
                <p className="mt-2 text-xs text-ink-soft sm:text-sm">
                  We never request spend keys or signing access.
                </p>
              </div>
              <div className="rounded-2xl border border-stroke bg-white/70 p-4 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both] [animation-delay:320ms] sm:p-5">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft sm:text-[0.75rem]">
                  Relay
                </p>
                <h3 className="mt-2 font-serif text-base sm:text-xl">
                  Status updates via API + webhooks.
                </h3>
                <p className="mt-2 text-xs text-ink-soft sm:text-sm">
                  Keep your systems updated without handing over control.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="px-[6vw] py-16">
        <div className="mb-10 grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-monero">
            How it works
          </p>
          <h2 className="font-serif text-3xl">
            A simple, non-custodial flow.
          </h2>
          <p className="text-ink-soft">
            Four steps. View-only access. No custody.
          </p>
        </div>
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both]">
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-monero/15 text-sm font-semibold text-monero">
              01
            </span>
            <h3 className="mb-2 font-serif text-xl">
              Log in with view-only access
            </h3>
            <p className="text-ink-soft">
              Use your primary address and secret view key to sign in.
            </p>
          </div>
          <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both] [animation-delay:100ms]">
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-monero/15 text-sm font-semibold text-monero">
              02
            </span>
            <h3 className="mb-2 font-serif text-xl">Create an invoice</h3>
            <p className="text-ink-soft">
              A subaddress for each invoice is generated automatically.
            </p>
          </div>
          <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both] [animation-delay:200ms]">
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-monero/15 text-sm font-semibold text-monero">
              03
            </span>
            <h3 className="mb-2 font-serif text-xl">Await payment</h3>
            <p className="text-ink-soft">
              A view-only wallet scans the blockchain for incoming funds.
            </p>
          </div>
          <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both] [animation-delay:300ms]">
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-monero/15 text-sm font-semibold text-monero">
              04
            </span>
            <h3 className="mb-2 font-serif text-xl">Relay status</h3>
            <p className="text-ink-soft">
              Webhook events deliver status updates to your systems.
            </p>
          </div>
        </div>
      </section>

      <section id="trust" className="px-[6vw] py-16">
        <div className="mb-10 grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-monero">
            Trust &amp; security
          </p>
          <h2 className="font-serif text-3xl">
            Built for clear trust boundaries.
          </h2>
        </div>
        <div className="grid gap-7 lg:grid-cols-3">
          <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both] lg:col-span-2">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 font-serif text-xl">What we do</h3>
                <ul className="grid gap-2 text-sm text-ink-soft">
                  <li>Detect on-chain payments with view-only keys.</li>
                  <li>Create invoices and subaddresses automatically.</li>
                  <li>Relay status via API and webhooks.</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-serif text-xl">What we never do</h3>
                <ul className="grid gap-2 text-sm text-ink-soft">
                  <li>Never request spend keys or signing access.</li>
                  <li>Never move, pool, or intermediate funds.</li>
                  <li>Never touch bank accounts or fiat rails.</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="grid gap-7">
            <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both] [animation-delay:100ms]">
              <h3 className="mb-2 font-serif text-xl">View-only boundary</h3>
              <p className="text-ink-soft">
                View-only access is the only permission we request, and it stops at
                detection.
              </p>
            </div>
            <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur animate-[rise_0.9s_ease_both] [animation-delay:200ms]">
              <h3 className="mb-2 font-serif text-xl">Safe on failure</h3>
              <p className="text-ink-soft">
                If the service is unavailable, funds remain safe and payments stay valid on-chain.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="cta" className="px-[6vw] pb-24 pt-10">
        <div className="relative grid gap-5 overflow-hidden rounded-3xl bg-ink p-10 text-cream shadow-deep">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(242,104,34,0.5),transparent_70%)] blur-2xl"></div>
            <div className="absolute bottom-[-120px] left-[-40px] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(93,122,106,0.4),transparent_70%)] blur-2xl"></div>
          </div>
          <h2 className="font-serif text-3xl">
            Use Monero without giving up custody.
          </h2>
          <p className="text-cream/80">
            Hosted invoice pages, API, and webhooks for status updates. View-only access, no fund movement.
          </p>
          <div className="flex flex-wrap gap-3">
            <LoginTrigger
              className="inline-flex items-center justify-center rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream transition hover:-translate-y-0.5"
            >
              Log in
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
