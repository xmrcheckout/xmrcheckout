import type { Metadata } from "next";
import Link from "next/link";

import PageIntroBand from "../../../components/page-intro-band";
import { getI18n } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const title = t("guides.metaTitle");
  const description = t("guides.metaDescription");
  return {
    title: t("nav.guides"),
    description,
    alternates: { canonical: "/guides" },
    openGraph: { type: "website", url: "/guides", siteName: "XMR Checkout", title, description },
    twitter: { card: "summary", title, description },
  };
}

const cardClass =
  "group rounded-surface border border-stroke bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-ink/30 sm:p-7";

export default async function GuidesPage() {
  const { t } = await getI18n();
  return (
    <main id="main-content" tabIndex={-1} className="reference-page px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-7xl">
        <PageIntroBand
          eyebrow={t("nav.guides")}
          id="guides-title"
          title={t("guides.title")}
          description={
            <p>
              {t("guides.intro")}
            </p>
          }
        />

        <section className="mt-8 grid gap-5 md:grid-cols-2" aria-label={t("nav.guides")}>
          <Link className={cardClass} href="/guides/monero-payment-buttons">
            <p className="text-sm font-semibold text-ink-soft">{t("guides.buttonsAudience")}</p>
            <h2 className="mt-2 font-sans text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">{t("guides.buttonsTitle")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("guides.buttonsBody")}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-ink">{t("guides.buttonsCta")}</span>
          </Link>
          <Link className={cardClass} href="/guides/in-person-monero-checkout">
            <p className="text-sm font-semibold text-ink-soft">{t("guides.terminalAudience")}</p>
            <h2 className="mt-2 font-sans text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">{t("guides.terminalTitle")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("guides.terminalBody")}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-ink">{t("guides.terminalCta")}</span>
          </Link>
          <Link className={cardClass} href="/guides/self-hosted-monero-checkout">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-clay" aria-hidden="true" />
              {t("guides.operatorsAudience")}
            </p>
            <h2 className="mt-2 font-sans text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">
              {t("guides.selfHostTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {t("guides.selfHostBody")}
            </p>
            <span className="mt-5 inline-flex text-sm font-semibold text-ink">
              {t("guides.selfHostCta")}
            </span>
          </Link>

          <Link className={cardClass} href="/guides/monero-payment-api-webhooks">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-sage" aria-hidden="true" />
              {t("guides.developersAudience")}
            </p>
            <h2 className="mt-2 font-sans text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">
              {t("guides.apiTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {t("guides.apiBody")}
            </p>
            <span className="mt-5 inline-flex text-sm font-semibold text-ink">
              {t("guides.apiCta")}
            </span>
          </Link>
        </section>

        <aside className="mt-8 rounded-surface border border-ink bg-ink px-6 py-6 text-cream shadow-card sm:px-8">
          <p className="text-sm font-semibold text-cream/60">{t("guides.needReference")}</p>
          <h2 className="mt-1 font-sans text-2xl font-semibold">
            {t("guides.browseDocs")}
          </h2>
          <p className="mt-2 max-w-2xl text-cream/70">
            {t("guides.referenceBody")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream bg-cream px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              href="/docs"
            >
              {t("guides.apiDocs")}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-cream transition hover:border-cream hover:bg-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              href="/docs/integrations"
            >
              {t("guides.recipes")}
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
