import Link from "next/link";

import InvoicePaymentDetails from "./invoice-payment-details";

type TourInvoicePreviewProps = {
  invoice: {
    id: string;
    address: string;
    subaddress_index?: number | null;
    amount_xmr: string;
    status: "pending" | "payment_detected" | "confirmed" | "expired" | "invalid";
    confirmation_target: number;
    confirmations?: number | null;
    created_at: string;
    detected_at: string | null;
    confirmed_at: string | null;
    expires_at: string | null;
    metadata?: Record<string, string> | null;
  };
};

const formatTimestamp = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

export default function TourInvoicePreview({
  invoice,
}: TourInvoicePreviewProps) {
  const confirmations = Math.max(0, invoice.confirmations ?? 0);
  const timelineItems = [
    { label: "Invoice created", value: invoice.created_at },
    ...(invoice.detected_at
      ? [{ label: "Payment detected", value: invoice.detected_at }]
      : []),
    ...(invoice.confirmed_at
      ? [{ label: "Payment confirmed", value: invoice.confirmed_at }]
      : []),
  ];

  return (
    <article className="grid gap-6" aria-labelledby="tour-invoice-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stroke pb-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2 w-2 rounded-full bg-clay" aria-hidden="true" />
            View invoice
          </p>
          <h1
            className="mt-1 font-sans text-3xl font-semibold leading-tight"
            id="tour-invoice-title"
          >
            Customer-facing payment request
          </h1>
          <p className="mt-2 text-ink-soft">
            This is the public page a customer uses to review the amount and
            follow on-chain confirmation progress.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
          href="/tour?tab=invoices"
        >
          Back to invoices
        </Link>
      </header>

      <div className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">
        Tour mode: this invoice is simulated. No payment is requested and the
        status does not refresh from the network.
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.65fr)] xl:items-start">
        <InvoicePaymentDetails
          simulation
          address={invoice.address}
          amount={invoice.amount_xmr}
          hasDetectedPayment={
            invoice.status === "payment_detected" ||
            invoice.status === "confirmed"
          }
          status={invoice.status}
          confirmationTarget={invoice.confirmation_target}
          confirmations={confirmations}
          enableFiatEstimate={false}
        />

        <aside className="overflow-hidden rounded-surface border border-stroke bg-card shadow-card">
          <div className="border-b border-stroke px-5 py-4">
            <p className="text-xs font-semibold text-ink-soft">
              Invoice context
            </p>
            <h2 className="mt-1 text-lg font-semibold">Invoice details</h2>
          </div>

          <dl className="divide-y divide-stroke px-5 py-2 text-sm">
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">Invoice ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-ink">
                {invoice.id}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-4 py-3">
              <div>
                <dt className="text-xs font-semibold text-ink-soft">Created</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {formatTimestamp(invoice.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-soft">Expires</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {formatTimestamp(invoice.expires_at)}
                </dd>
              </div>
            </div>
            <div className="py-3">
              <dt className="text-xs font-semibold text-ink-soft">
                Confirmations
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {confirmations}/{invoice.confirmation_target}
              </dd>
            </div>
            {invoice.subaddress_index !== null &&
            invoice.subaddress_index !== undefined ? (
              <div className="py-3">
                <dt className="text-xs font-semibold text-ink-soft">
                  Subaddress index
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold">
                  {invoice.subaddress_index}
                </dd>
              </div>
            ) : null}
            {invoice.metadata?.description ? (
              <div className="py-3">
                <dt className="text-xs font-semibold text-ink-soft">
                  Description
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {invoice.metadata.description}
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="border-t border-stroke bg-sand/50 px-5 py-4 text-xs leading-relaxed text-ink-soft">
            This status page is public. Anyone with the link can view the
            current invoice state.
          </p>
        </aside>
      </div>

      <section className="border-y border-stroke py-6" aria-labelledby="tour-invoice-timeline">
        <h2 className="text-xl font-semibold" id="tour-invoice-timeline">
          Invoice timeline
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...timelineItems].reverse().map((item) => (
            <li className="border-l-2 border-sage pl-4" key={item.label}>
              <p className="text-xs font-semibold text-ink-soft">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">
                {formatTimestamp(item.value)}
              </p>
            </li>
          ))}
        </ol>
      </section>

    </article>
  );
}
