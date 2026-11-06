import { publicPageMetadata } from "../../../lib/site-metadata";
import type { Metadata } from "next";

import InvoiceStatusLookup from "../../../components/invoice-status-lookup";
import PageIntroBand from "../../../components/page-intro-band";
import { getI18n } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return publicPageMetadata({ title: t("lookupPage.ogTitle"), description: t("lookupPage.metaDescription"), path: "/invoice", locale });
}

const statusPath = [
  { key: "detected", dotClass: "bg-monero" },
  { key: "confirming", dotClass: "bg-amber-500" },
  { key: "confirmed", dotClass: "bg-sage" },
] as const;

export default async function InvoiceStatusPage() {
  const { t } = await getI18n();
  return (
    <main id="main-content" tabIndex={-1} className="px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-7xl">
        <PageIntroBand
          id="invoice-status-title"
          eyebrow={t("lookupPage.eyebrow")}
          title={t("lookupPage.title")}
          description={<p>{t("lookupPage.description")}</p>}
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
              {t("lookupPage.publicLookup")}
            </p>
            <h2
              className="mt-1 font-sans text-2xl font-semibold"
              id="lookup-title"
            >
              {t("lookupPage.find")}
            </h2>
            <p className="mt-2 text-ink-soft">
              {t("lookupPage.publicNote")}
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
                {t("lookupPage.exampleStatus")}
              </p>
              <h2
                className="mt-1 font-sans text-xl font-semibold"
                id="status-path-title"
              >
                {t("lookupPage.customerSees")}
              </h2>
            </div>
            <ol className="divide-y divide-stroke">
              {statusPath.map((item, index) => (
                <li
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-5 py-4 sm:px-6"
                  key={item.key}
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
                        {t(`lookupPage.path.${item.key}.label`)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{t(`lookupPage.path.${item.key}.detail`)}</p>
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
