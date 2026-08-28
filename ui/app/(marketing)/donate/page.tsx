import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DonationForm from "../../../components/donation-form";
import PageIntroBand from "../../../components/page-intro-band";
import { areDonationsEnabled } from "../../../lib/donations";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support XMR Checkout with a direct-to-wallet Monero donation.",
};

export default function DonatePage() {
  if (!areDonationsEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-[6vw] pb-20 pt-10 text-ink">
      <PageIntroBand
        description="Choose an XMR amount and create a payment request."
        eyebrow="Support the project"
        id="donate-title"
        title="Support continued XMR Checkout development."
      />

      <section className="mt-6 max-w-3xl">
        <div className="rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-7">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-clay" aria-hidden="true" />
            Donation amount
          </p>
          <h2 className="mt-2 font-sans text-2xl font-semibold">
            Create an XMR donation request
          </h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            The resulting page shows the exact amount, wallet address, QR code,
            and on-chain detection status.
          </p>
          <div className="mt-6">
            <DonationForm />
          </div>
        </div>
      </section>
    </main>
  );
}
