import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InvoiceJourney } from "../../components/invoice-journey";

import { LoginTrigger } from "../../components/login-modal";
import { getI18n } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { absolute: t("home.metaTitle") },
    description: t("home.metaDescription"),
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: "XMR Checkout",
      title: t("home.metaTitle"),
      description: t("home.metaDescription"),
    },
  };
}

export default async function MarketingHomePage({
  searchParams,
}: {
  searchParams: Promise<{ donate?: string | string[] }>;
}) {
  const query = await searchParams;
  const { t } = await getI18n();
  if (query.donate === "1") {
    redirect("/donate");
  }

  return (
    <main id="main-content" tabIndex={-1} className="home-page text-ink">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <p className="home-kicker">{t("home.kicker")}</p>
          <h1 id="home-hero-title">{t("home.title")}</h1>
          <p className="home-lead">
            {t("home.lead")}
          </p>
          <div className="home-actions" role="group" aria-label={t("home.primaryActions")}>
            <Link className="home-button home-button-primary" href="/tour">
              {t("home.exploreDemo")}
            </Link>
            <LoginTrigger className="home-button home-button-secondary">
              {t("nav.connect")}
            </LoginTrigger>
          </div>
          <p className="home-entry-note">
            <strong>{t("home.demoQ")}</strong> {t("home.demoA")}
          </p>
          <p className="home-entry-note">
            <strong>{t("home.readyQ")}</strong> {t("home.readyA")}
          </p>
        </div>

        <InvoiceJourney t={t} />
      </section>

      <section className="home-process" aria-labelledby="home-process-title">
        <div>
          <p className="home-kicker">{t("home.processKicker")}</p>
          <h2 id="home-process-title">{t("home.processTitle")}</h2>
        </div>
        <ol>
          <li><span>01</span><div><h3>{t("home.step1")}</h3><p>{t("home.step1Body")}</p></div></li>
          <li><span>02</span><div><h3>{t("home.step2")}</h3><p>{t("home.step2Body")}</p></div></li>
          <li><span>03</span><div><h3>{t("home.step3")}</h3><p>{t("home.step3Body")}</p></div></li>
        </ol>
      </section>

      <section className="home-wallet" aria-labelledby="home-wallet-title">
        <div className="home-wallet-copy">
          <p className="home-kicker">{t("home.walletKicker")}</p>
          <h2 id="home-wallet-title">{t("home.walletTitle")}</h2>
          <p>{t("home.walletBody")}</p>
        </div>
        <div className="home-wallet-table">
          <div><h3>{t("home.walletReceives")}</h3><p>{t("home.walletReceivesBody")}</p></div>
          <div><h3>{t("home.viewOnly")}</h3><p>{t("home.viewOnlyBody")}</p></div>
          <div><h3>{t("home.target")}</h3><p>{t("home.targetBody")}</p></div>
        </div>
      </section>

      <section className="home-integration" aria-labelledby="home-integration-title">
        <div>
          <p className="home-kicker">{t("home.startKicker")}</p>
          <h2 id="home-integration-title">{t("home.startTitle")}</h2>
          <p>{t("home.startBody")}</p>
          <div className="home-actions" role="group" aria-label={t("home.startLinks")}>
            <LoginTrigger className="home-button home-button-primary">{t("nav.connect")}</LoginTrigger>
            <Link className="home-doc-link" href="/guides/monero-payment-api-webhooks">{t("home.readApiGuide")}</Link>
          </div>
        </div>
        <div className="home-wallet-table">
          <div><h3>{t("home.linksTitle")}</h3><p>{t("home.linksBody")}</p><Link className="home-doc-link" href="/guides/monero-payment-buttons">{t("home.linksCta")}</Link></div>
          <div><h3>{t("home.selfHostTitle")}</h3><p>{t("home.selfHostBody")}</p><Link className="home-doc-link" href="/guides/self-hosted-monero-checkout">{t("home.selfHostCta")}</Link></div>
        </div>
      </section>
    </main>
  );
}
