import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import PageIntroBand from "../../../components/page-intro-band";
import { areDonationsEnabled } from "../../../lib/donations";
import { rich } from "../../../lib/i18n/rich";
import { getI18n } from "../../../lib/i18n/server";
import type { Translate } from "../../../lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("nav.faq"),
    description: t("faq.metaDescription"),
    alternates: { canonical: "/faq" },
    openGraph: {
      type: "website",
      url: "/faq",
      siteName: "XMR Checkout",
      title: t("faq.metaTitle"),
      description: t("faq.metaDescription"),
    },
  };
}

const donationsEnabled = areDonationsEnabled();

export const dynamic = "force-dynamic";

type FaqCategory = "custody" | "operations" | "comparisons";

type FaqItem = {
  id?: string;
  question: string;
  answer: ReactNode;
  category: FaqCategory;
};

const faqGroups: Array<{ id: FaqCategory; accentClass: string }> = [
  { id: "custody", accentClass: "bg-clay" },
  { id: "operations", accentClass: "bg-sage" },
  { id: "comparisons", accentClass: "bg-ink" },
];

const linkClass = "underline underline-offset-4";
const ctaClass = "font-semibold underline underline-offset-4";

// Each answer is built from catalog keys under faq.items.<key>: q (question),
// p1..pN (paragraphs), li1..liN (list items), after (paragraph after the list)
// and cta (link text for the call-to-action link).
type FaqDef = {
  key: string;
  id?: string;
  category: FaqCategory;
  paragraphs: number;
  listItems?: number;
  after?: boolean;
  cta?: string;
  showParagraph?: (index: number) => boolean;
};

const faqDefs: FaqDef[] = [
  { key: "inPerson", id: "in-person-terminal", category: "operations", paragraphs: 2, cta: "/guides/in-person-monero-checkout" },
  { key: "donations", id: "payment-link-donations", category: "operations", paragraphs: 2, cta: "/guides/monero-payment-buttons#donations" },
  { key: "badge", id: "accepted-here-badge", category: "operations", paragraphs: 1, cta: "/guides/monero-payment-buttons#let-people-find-you" },
  { key: "noWoo", category: "comparisons", paragraphs: 1, cta: "/guides/monero-payment-buttons" },
  { key: "vsQr", category: "operations", paragraphs: 1, cta: "/guides/monero-payment-buttons" },
  { key: "repeat", category: "operations", paragraphs: 1, cta: "/guides/monero-payment-buttons" },
  { key: "digital", category: "operations", paragraphs: 2, cta: "/guides/monero-payment-buttons#confirmation-message" },
  { key: "custodial", category: "custody", paragraphs: 1 },
  { key: "access", category: "custody", paragraphs: 1 },
  { key: "setup", category: "custody", paragraphs: 1 },
  { key: "email", category: "custody", paragraphs: 1 },
  { key: "cost", category: "operations", paragraphs: 2, showParagraph: (index) => index !== 2 || donationsEnabled },
  { key: "moveFunds", category: "custody", paragraphs: 1 },
  { key: "receipt", category: "operations", paragraphs: 1 },
  { key: "down", category: "operations", paragraphs: 1 },
  { key: "hosted", category: "comparisons", paragraphs: 1, listItems: 4, after: true },
  { key: "btcpay", category: "comparisons", paragraphs: 2, listItems: 3 },
  { key: "selfHost", category: "comparisons", paragraphs: 2 },
];

const faqTags = {
  strong: (text: string) => <span className="font-semibold text-ink">{text}</span>,
  link: (text: string) => <Link className={linkClass} href="/donate">{text}</Link>,
  github: (text: string) => <Link className={linkClass} href="https://github.com/xmrcheckout/xmrcheckout">{text}</Link>,
  docs: (text: string) => <Link className={linkClass} href="/docs">{text}</Link>,
  guide: (text: string) => <Link className={linkClass} href="/guides/self-hosted-monero-checkout">{text}</Link>,
};

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

function faqItems(t: Translate): FaqItem[] {
  return faqDefs.map((def) => {
    const k = `faq.items.${def.key}`;
    return {
      id: def.id,
      category: def.category,
      question: t(`${k}.q`),
      answer: (
        <>
          {range(def.paragraphs)
            .filter((index) => def.showParagraph?.(index) ?? true)
            .map((index) => (
              <p className="text-ink-soft" key={`p${index}`}>{rich(t(`${k}.p${index}`), faqTags)}</p>
            ))}
          {def.listItems ? (
            <ul className="mt-4 grid gap-2 text-sm text-ink-soft">
              {range(def.listItems).map((index) => (
                <li key={`li${index}`}>{rich(t(`${k}.li${index}`), faqTags)}</li>
              ))}
            </ul>
          ) : null}
          {def.after ? <p className="mt-4 text-ink-soft">{t(`${k}.after`)}</p> : null}
          {def.cta ? (
            <p className="mt-3"><Link className={ctaClass} href={def.cta}>{t(`${k}.cta`)}</Link></p>
          ) : null}
        </>
      ),
    };
  });
}

function FaqCard({ item }: { item: FaqItem }) {
  return (
    <details id={item.id} className="scroll-mt-24 group border-t border-stroke px-5 py-5 first:border-t-0 sm:px-6">
      <summary className="cursor-pointer list-none select-none font-sans font-semibold text-lg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden sm:text-xl">
        <span className="flex items-start justify-between gap-4">
          <span>{item.question}</span>
          <span
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stroke bg-cream text-sm text-ink-soft transition group-open:rotate-45"
            aria-hidden="true"
          >
            +
          </span>
        </span>
      </summary>
      <div className="mt-4 grid gap-3 text-sm leading-relaxed">
        {item.answer}
      </div>
    </details>
  );
}

export default async function FaqPage() {
  const { t } = await getI18n();
  const items = faqItems(t);
  return (
    <main id="main-content" tabIndex={-1} className="px-[6vw] pb-20 pt-8 text-ink">
      <section
        className="mx-auto w-full max-w-7xl"
        aria-label={t("faq.introLabel")}
      >
        <PageIntroBand
          eyebrow={t("faq.eyebrow")}
          id="faq-title"
          title={t("faq.title")}
          description={
            <p>{t("faq.description")}</p>
          }
        />
      </section>

      <div className="mx-auto mt-6 grid w-full max-w-7xl gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <nav
          className="min-w-0 lg:sticky lg:top-24 lg:self-start"
          aria-label={t("faq.categories")}
        >
          <div className="overflow-hidden rounded-surface border border-stroke bg-card shadow-soft">
            <div className="border-b border-stroke px-5 py-4">
              <p className="font-sans text-base font-semibold">
                {t("faq.browse")}
              </p>
              <p className="mt-1 hidden text-sm text-ink-soft lg:block">
                {t("faq.browseHelp")}
              </p>
            </div>
            <div className="grid gap-1.5 p-3">
              {faqGroups.map((group) => (
                <a
                  className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-stroke hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href={`#${group.id}`}
                  key={group.id}
                >
                  {t(`faq.groups.${group.id}.label`)}
                </a>
              ))}
            </div>
          </div>
        </nav>

        <div className="min-w-0 space-y-8">
          {faqGroups.map((group) => {
            const groupItems = items.filter((item) => item.category === group.id);

            return (
              <section
                className="scroll-mt-24"
                id={group.id}
                key={group.id}
                aria-labelledby={`${group.id}-title`}
              >
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stroke pb-4">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${group.accentClass}`}
                        aria-hidden="true"
                      />
                      {t("faq.questions")}
                    </p>
                    <h2
                      className="mt-1 font-sans text-2xl font-semibold"
                      id={`${group.id}-title`}
                    >
                      {t(`faq.groups.${group.id}.label`)}
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {t(`faq.groups.${group.id}.description`)}
                    </p>
                  </div>
                  <span className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-xs font-semibold text-ink-soft">
                    {t("faq.answers", { count: groupItems.length })}
                  </span>
                </header>
                <div className="mt-4 overflow-hidden rounded-surface border border-stroke bg-white/70 shadow-soft">
                  {groupItems.map((item) => (
                    <FaqCard key={item.question} item={item} />
                  ))}
                </div>
              </section>
            );
          })}

          <aside className="overflow-hidden rounded-surface border border-ink bg-ink px-6 py-6 text-cream shadow-card sm:px-8">
            <p className="text-sm font-semibold text-cream/60">{t("faq.moreDetail")}</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold">
              {t("faq.stillQuestions")}
            </h2>
            <p className="mt-2 text-cream/70">
              {rich(t("faq.startWithDocs"), {
                docs: (text) => (
                  <Link className="font-semibold text-cream underline decoration-clay underline-offset-4" href="/docs">
                    {text}
                  </Link>
                ),
              })}
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
