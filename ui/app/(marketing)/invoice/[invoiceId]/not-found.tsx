import InvoiceStatusLookup from "../../../../components/invoice-status-lookup";
import PageIntroBand from "../../../../components/page-intro-band";
import { getI18n } from "../../../../lib/i18n/server";

export default async function InvoiceNotFound() {
  const { t } = await getI18n();
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
      <PageIntroBand eyebrow={t("invoicePage.lookupEyebrow")} id="invoice-not-found"
        title={t("invoicePage.linkUnavailableTitle")}
        description={t("invoicePage.linkUnavailableHelp")} />
      <section className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
        <h2 className="text-lg font-semibold">{t("invoicePage.checkAnother")}</h2>
        <div className="mt-4 max-w-2xl"><InvoiceStatusLookup compact /></div>
      </section>
    </main>
  );
}
