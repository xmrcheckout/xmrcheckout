import InvoiceStatusLookup from "../../../../components/invoice-status-lookup";
import PageIntroBand from "../../../../components/page-intro-band";

export default function InvoiceNotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
      <PageIntroBand eyebrow="Invoice lookup" id="invoice-not-found"
        title="Invoice link unavailable"
        description="The invoice ID is invalid or does not match an invoice. Enter the complete ID in UUID format, or contact the merchant for a valid link. Do not send payment." />
      <section className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
        <h2 className="text-lg font-semibold">Check another invoice</h2>
        <div className="mt-4 max-w-2xl"><InvoiceStatusLookup compact /></div>
      </section>
    </main>
  );
}
