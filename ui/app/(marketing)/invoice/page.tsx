import type { Metadata } from "next";

import InvoiceStatusLookup from "../../../components/invoice-status-lookup";

export const metadata: Metadata = {
  title: "Invoice Status",
};

export default function InvoiceStatusPage() {
  return (
    <main className="px-[6vw] pb-20 pt-10 text-ink">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="grid gap-6">
          <div className="grid gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
              Invoice status
            </p>
            <h1 className="font-serif text-[clamp(2.2rem,2rem+1.4vw,3.4rem)] leading-[1.1]">
              Check a Monero invoice status.
            </h1>
            <p className="text-[1.05rem] leading-relaxed text-ink-soft">
              Paste the invoice id to see detection and confirmation state.
            </p>
          </div>
          <div className="rounded-2xl border border-stroke bg-card p-7 shadow-card backdrop-blur">
            <InvoiceStatusLookup />
          </div>
        </div>
        <div className="grid gap-6">
          <div className="rounded-2xl border border-stroke bg-card p-7 shadow-card backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">
              View-only detection
            </p>
            <h2 className="mt-2 font-serif text-2xl">No sign-in required.</h2>
            <p className="mt-2 text-ink-soft">
              Anyone with the invoice id can view its status. Share this page with
              customers who need a quick update.
            </p>
          </div>
          <div className="rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">
              Example status
            </p>
            <h2 className="mt-2 font-serif text-2xl">What you will see.</h2>
            <div className="mt-4 grid gap-3 text-sm text-ink-soft">
              <div className="flex items-center gap-3">
                <span className="timeline-dot is-active h-2.5 w-2.5 rounded-full bg-monero"></span>
                <span className="font-semibold text-ink">Detected</span>
                <span>Seen on the network</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-monero/60"></span>
                <span className="font-semibold text-ink">Confirming</span>
                <span>Waiting on confirmations</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-ink/20"></span>
                <span className="font-semibold text-ink">Confirmed</span>
                <span>Target reached</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
