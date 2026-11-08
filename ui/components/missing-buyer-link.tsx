import Link from "next/link";
import InvoiceStatusLookup from "./invoice-status-lookup";
import PageIntroBand from "./page-intro-band";
import { getI18n } from "../lib/i18n/server";

export default async function MissingBuyerLink({ kind, invalid = false }: {
  kind: "invoice" | "payment" | "compact" | "receipt";
  invalid?: boolean;
}) {
  const { t } = await getI18n();
  const compact = kind === "compact" || kind === "receipt";
  const title = kind === "payment" ? t("paymentLink.unavailableTitle") : compact ? invalid ? t("checkout.invalidId") : t("checkout.notFound") : t("invoicePage.linkUnavailableTitle");
  const help = kind === "payment" ? t("paymentLink.unavailableHelp") : kind === "receipt" ? t("receipt.notFoundHelp") : compact ? `${invalid ? t("checkout.invalidIdHelp") : t("checkout.notFoundHelp")} ${t("checkout.doNotPay")}` : t("invoicePage.linkUnavailableHelp");
  const lookup = kind === "invoice" || compact;
  return <main id="main-content" tabIndex={-1} className={`mx-auto w-full ${compact ? "max-w-4xl px-3 py-6 sm:px-6" : "max-w-7xl px-[6vw] pb-20 pt-10"} text-ink`}>
    <PageIntroBand eyebrow={t("invoicePage.lookupEyebrow")} id="missing-buyer-link" title={title} description={help} />
    {lookup ? <section className="mt-6 border-y border-stroke bg-sand/40 px-5 py-6 sm:px-7">
      <h2 className="text-lg font-semibold">{t("invoicePage.checkAnother")}</h2>
      <div className="mt-4 max-w-2xl"><InvoiceStatusLookup compact /></div>
    </section> : <Link className="mt-6 inline-flex min-h-11 items-center underline" href="/">{t("common.returnHome")}</Link>}
  </main>;
}
