import { publicPageMetadata } from "../../../../lib/site-metadata";
import GuideContents from "../../../../components/guide-contents";
import type { Metadata } from "next";
import Link from "next/link";
import PageIntroBand from "../../../../components/page-intro-band";
import { rich } from "../../../../lib/i18n/rich";
import { getI18n } from "../../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return publicPageMetadata({ title: t("guides.inPerson.title"), description: t("guides.inPerson.metaDescription"), path: "/guides/in-person-monero-checkout", locale, type: "article" });
}
const sectionClass = "min-w-0 scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-8";
// Section ids with the number of ordered steps and paragraphs each has in the catalog.
const sections = [
  { id: "setup", steps: 4, paragraphs: 1 },
  { id: "sale", steps: 4, paragraphs: 1 },
  { id: "confirmations", steps: 0, paragraphs: 2 },
  { id: "security", steps: 0, paragraphs: 2 },
  { id: "limits", steps: 0, paragraphs: 2 },
] as const;
const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);
const tags = {
  strong: (text: string) => <strong>{text}</strong>,
  link: (text: string) => <Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/monero-payment-buttons#let-people-find-you">{text}</Link>,
};

export default async function InPersonGuide() {
  const { t } = await getI18n();
  const k = "guides.inPerson";
  return <main id="main-content" tabIndex={-1} className="reference-page px-[6vw] pb-20 pt-8 text-ink"><div className="mx-auto w-full max-w-5xl">
    <PageIntroBand eyebrow={t(`${k}.eyebrow`)} id="terminal-guide-title" title={t(`${k}.title`)} description={<p>{t(`${k}.intro`)}</p>} />
    <GuideContents label={t(`${k}.sectionsLabel`)} entries={sections.map(({ id }) => ({ href: `#${id}`, label: t(`${k}.${id}.title`) }))} />
    <div className="mt-8 grid gap-6">
      {sections.map(({ id, steps, paragraphs }) => (
        <section key={id} id={id} aria-labelledby={`${id}-title`} className={sectionClass}>
          <h2 id={`${id}-title`} className="font-sans text-2xl font-semibold">{t(`${k}.${id}.title`)}</h2>
          {steps ? (
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              {range(steps).map((index) => <li key={index}>{rich(t(`${k}.${id}.step${index}`), tags)}</li>)}
            </ol>
          ) : null}
          {range(paragraphs).map((index) => (
            <p key={index} className={index === 1 ? "mt-4" : "mt-3"}>{rich(t(`${k}.${id}.p${index}`), tags)}</p>
          ))}
        </section>
      ))}
    </div>
  </div></main>;
}
