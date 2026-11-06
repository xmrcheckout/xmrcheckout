import { publicPageMetadata } from "../../../../lib/site-metadata";
import GuideContents from "../../../../components/guide-contents";
import type { Metadata } from "next";
import Link from "next/link";

import PageIntroBand from "../../../../components/page-intro-band";
import { getI18n } from "../../../../lib/i18n/server";
import type { Translate } from "../../../../lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return publicPageMetadata({ title: t("guides.selfHost.metaTitle"), description: t("guides.selfHost.metaDescription"), path: "/guides/self-hosted-monero-checkout", locale, type: "article" });
}

const sectionClass =
  "min-w-0 scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-8";
const codeClass =
  "mt-4 overflow-x-auto rounded-surface border border-ink bg-ink px-5 py-4 text-xs leading-relaxed text-cream shadow-soft";

const sectionsFor = (t: Translate) => [
  ["#architecture", t("guides.selfHost.navFlow")],
  ["#requirements", t("guides.selfHost.navHost")],
  ["#docker", t("guides.selfHost.navDocker")],
  ["#verify", t("guides.selfHost.navVerify")],
  ["#troubleshooting", t("guides.selfHost.navTroubleshoot")],
] as const;

export default async function SelfHostedGuidePage() {
  const { t } = await getI18n();
  return (
    <main id="main-content" tabIndex={-1} className="reference-page px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-5xl">
        <PageIntroBand
          eyebrow={t("guides.selfHost.eyebrow")}
          id="self-hosted-guide-title"
          title={t("guides.selfHost.title")}
          description={
            <p>
              {t("guides.selfHost.intro")}
            </p>
          }
        />

        <GuideContents label={t("guides.selfHost.sectionsLabel")} entries={sectionsFor(t).map(([href, label]) => ({ href, label }))} />

        <div className="mt-8 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          <section className={sectionClass} id="architecture" aria-labelledby="architecture-title">
            <p className="text-sm font-semibold text-ink-soft">{t("guides.selfHost.flowEyebrow")}</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="architecture-title">
              {t("guides.selfHost.flowTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              {t("guides.selfHost.flowBody")}
            </p>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["01", t("guides.selfHost.create"), t("guides.selfHost.createBody")],
                ["02", t("guides.selfHost.observe"), t("guides.selfHost.observeBody")],
                ["03", t("guides.selfHost.report"), t("guides.selfHost.reportBody")],
              ].map(([number, title, description]) => (
                <li className="rounded-2xl border border-stroke bg-white/60 p-4" key={number}>
                  <span className="font-mono text-xs text-ink-soft">{number}</span>
                  <h3 className="mt-2 font-sans font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={sectionClass} id="requirements" aria-labelledby="requirements-title">
            <p className="text-sm font-semibold text-ink-soft">{t("guides.selfHost.hostEyebrow")}</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="requirements-title">
              {t("guides.selfHost.hostTitle")}
            </h2>
            <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-ink-soft sm:grid-cols-2">
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                {t("guides.selfHost.host1")}
              </li>
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                {t("guides.selfHost.host2")}
              </li>
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                {t("guides.selfHost.host3")}
              </li>
              <li className="rounded-2xl border border-stroke bg-white/60 p-4">
                {t("guides.selfHost.host4")}
              </li>
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-ink-soft">
              {t("guides.selfHost.hostNote")}
            </p>
            <Link
              className="mt-4 inline-flex text-sm font-semibold text-ink underline decoration-clay underline-offset-4"
              href="https://github.com/xmrcheckout/xmrcheckout#self-hosted-deployment-docker-compose"
              target="_blank"
              rel="noreferrer"
            >
              {t("guides.selfHost.composeRef")}
            </Link>
          </section>

          <section className={sectionClass} id="docker" aria-labelledby="docker-title">
            <p className="text-sm font-semibold text-ink-soft">{t("guides.selfHost.dockerEyebrow")}</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="docker-title">
              {t("guides.selfHost.dockerTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              {t("guides.selfHost.dockerBody")}
            </p>
            <pre className={codeClass} tabIndex={0} role="region" aria-label={t("guides.selfHost.commandExample")}>
              <code>{`cp .env.example .env
docker compose --profile local-daemon up --build -d

# If MONERO_DAEMON_URL points to a daemon outside this stack:
docker compose up --build -d`}</code>
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {t("guides.selfHost.dockerNote")}
            </p>
          </section>

          <section className={sectionClass} id="verify" aria-labelledby="verify-title">
            <p className="text-sm font-semibold text-ink-soft">{t("guides.selfHost.verifyEyebrow")}</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="verify-title">
              {t("guides.selfHost.verifyTitle")}
            </h2>
            <ol className="mt-4 grid gap-3 text-sm leading-relaxed text-ink-soft">
              <li className="flex gap-3 rounded-2xl border border-stroke bg-white/60 p-4">
                <span className="font-mono text-xs text-ink-soft">01</span>
                {t("guides.selfHost.verify1")}
              </li>
              <li className="flex gap-3 rounded-2xl border border-stroke bg-white/60 p-4">
                <span className="font-mono text-xs text-ink-soft">02</span>
                {t("guides.selfHost.verify2")}
              </li>
              <li className="flex gap-3 rounded-2xl border border-stroke bg-white/60 p-4">
                <span className="font-mono text-xs text-ink-soft">03</span>
                {t("guides.selfHost.verify3")}
              </li>
              <li className="flex gap-3 rounded-2xl border border-stroke bg-white/60 p-4">
                <span className="font-mono text-xs text-ink-soft">04</span>
                {t("guides.selfHost.verify4")}
              </li>
            </ol>
          </section>

          <section className={sectionClass} id="troubleshooting" aria-labelledby="troubleshooting-title">
            <p className="text-sm font-semibold text-ink-soft">{t("guides.selfHost.troubleEyebrow")}</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold" id="troubleshooting-title">
              {t("guides.selfHost.troubleTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              {t("guides.selfHost.troubleBody")}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {t("guides.selfHost.troubleNote")}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                href="/faq#operations"
              >
                {t("guides.selfHost.opsFaq")}
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                href="/tour"
              >
                {t("guides.selfHost.exploreDemo")}
              </Link>
            </div>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-stroke pt-6 text-sm text-ink-soft">
          <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides">
            {t("guides.selfHost.backToGuides")}
          </Link>
          <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/monero-payment-api-webhooks">
            {t("guides.selfHost.continueApi")}
          </Link>
        </footer>
      </div>
    </main>
  );
}
