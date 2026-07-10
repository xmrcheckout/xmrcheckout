import type { Metadata } from "next";

import InvoiceStatusLookup from "../../../components/invoice-status-lookup";
import PageIntroBand from "../../../components/page-intro-band";

export const metadata: Metadata = {
  title: "Invoice Status",
};

const statusPath = [
  {
    label: "Detected",
    detail: "Incoming XMR is visible on-chain.",
    dotClass: "bg-monero",
  },
  {
    label: "Confirming",
    detail: "The configured target is not reached yet.",
    dotClass: "bg-amber-500",
  },
  {
    label: "Confirmed",
    detail: "The required confirmation target is reached.",
    dotClass: "bg-sage",
  },
] as const;

export default function InvoiceStatusPage() {
  return (
    <main className="px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-7xl">
        <PageIntroBand
          id="invoice-status-title"
          eyebrow="Invoice status"
          title="Check a Monero invoice status."
          description={
            <p>
              Paste an invoice id to see detection and confirmation progress.
              This public view never requests wallet credentials.
            </p>
          }
          facts={[
            { label: "Access", value: "No sign-in" },
            { label: "Detection", value: "View only" },
            { label: "Funds", value: "Merchant wallet" },
          ]}
        />

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)] lg:items-start">
          <section
            className="rounded-surface border border-stroke bg-card p-6 shadow-card sm:p-7"
            aria-labelledby="lookup-title"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="h-2 w-2 rounded-full bg-clay"
                aria-hidden="true"
              />
              Public lookup
            </p>
            <h2
              className="mt-1 font-sans text-2xl font-semibold"
              id="lookup-title"
            >
              Find an invoice
            </h2>
            <p className="mt-2 text-ink-soft">
              Anyone with the invoice id can view its current state. No changes
              can be made from this page.
            </p>
            <div className="mt-6">
              <InvoiceStatusLookup />
            </div>
          </section>

          <section
            className="overflow-hidden rounded-surface border border-stroke bg-white/70 shadow-soft"
            aria-labelledby="status-path-title"
          >
            <div className="border-b border-stroke bg-sand/50 px-5 py-4 sm:px-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="h-2 w-2 rounded-full bg-clay"
                  aria-hidden="true"
                />
                Example status
              </p>
              <h2
                className="mt-1 font-sans text-xl font-semibold"
                id="status-path-title"
              >
                What the customer will see
              </h2>
            </div>
            <ol className="divide-y divide-stroke">
              {statusPath.map((item, index) => (
                <li
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-5 py-4 sm:px-6"
                  key={item.label}
                >
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 rounded-full ${item.dotClass}`}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink-soft">
                        0{index + 1}
                      </span>
                      <p className="text-sm font-semibold text-ink">
                        {item.label}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </section>
      </div>
    </main>
  );
}
