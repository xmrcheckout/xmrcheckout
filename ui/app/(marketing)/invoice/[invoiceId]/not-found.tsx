"use client";

import { useParams } from "next/navigation";
import InvoiceStatusLookup from "../../../../components/invoice-status-lookup";
import PageIntroBand from "../../../../components/page-intro-band";

export default function InvoiceNotFound() {
  const { invoiceId = "" } = useParams<{ invoiceId: string }>();
  const validFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
  return (
    <main className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
      <PageIntroBand eyebrow="Invoice lookup" id="invoice-not-found"
        title={validFormat ? "Invoice not found" : "Invalid invoice ID"}
        description={validFormat ? "Check the invoice ID or ask the merchant for the complete link. Do not send payment." : "Enter the complete invoice ID in UUID format. Do not send payment using an invalid link."} />
      <section className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
        <h2 className="text-lg font-semibold">Check another invoice</h2>
        <div className="mt-4 max-w-2xl"><InvoiceStatusLookup initialValue={invoiceId} compact /></div>
      </section>
    </main>
  );
}
