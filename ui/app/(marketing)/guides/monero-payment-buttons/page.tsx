import { publicPageMetadata } from "../../../../lib/site-metadata";
import GuideContents from "../../../../components/guide-contents";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import PageIntroBand from "../../../../components/page-intro-band";
import CopyCodeBlock from "../../../../components/copy-code-block";
import { GuideBlocks, type GuideBlock } from "../../../../components/guide-blocks";
import { getI18n } from "../../../../lib/i18n/server";
import { DEFAULT_BUTTON_SUB, paymentButtonHtml } from "../../../../lib/payment-button";

const k = "guides.buttons";
export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return publicPageMetadata({ title: t("guides.buttons.title"), description: t("guides.buttons.metaDescription"), path: "/guides/monero-payment-buttons", locale, type: "article" });
}
const sectionClass = "min-w-0 scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-8";
const codeClass = "mt-4 max-w-full overflow-x-auto rounded-xl bg-ink px-5 pb-5 pt-16 font-mono text-sm text-cream";
const linkClass = "font-semibold underline decoration-clay underline-offset-4";
const sections = ["setup", "embed", "invoices", "confirmation-message", "manage", "donations", "let-people-find-you", "limits"] as const;
const tags = {
  strong: (text: string) => <strong>{text}</strong>,
  dashboard: (text: string) => <Link href="/dashboard?tab=payment-links" className={linkClass}>{text}</Link>,
  donations: (text: string) => <a href="#donations" className={linkClass}>{text}</a>,
  message: (text: string) => <a href="#confirmation-message" className={linkClass}>{text}</a>,
  selfhost: (text: string) => <Link href="/guides/self-hosted-monero-checkout" className={linkClass}>{text}</Link>,
  webhooks: (text: string) => <Link href="/guides/monero-payment-api-webhooks#webhooks" className={linkClass}>{text}</Link>,
  terminal: (text: string) => <Link href="/guides/in-person-monero-checkout" className={linkClass}>{text}</Link>,
  limits: (text: string) => <a className={linkClass} href="#limits">{text}</a>,
  api: (text: string) => <Link href="/docs#payment-links" className={linkClass}>{text}</Link>,
};

const sectionBlocks = (nodes: Record<string, ReactNode>): Record<string, GuideBlock[]> => ({
  "setup": [{ kind: "ol", items: 5 }, { kind: "p", className: "mt-4" }, { kind: "p", className: "mt-3 text-sm text-ink-soft" }],
  "embed": [{ kind: "p", className: "mt-4" }, { kind: "node", node: nodes.buttonCode }, { kind: "p", className: "mt-3 text-sm text-ink-soft" }, { kind: "p", className: "mt-4" }, { kind: "p" }],
  "invoices": [{ kind: "p", className: "mt-4" }, { kind: "p" }, { kind: "p" }],
  "confirmation-message": [{ kind: "p", className: "mt-4" }, { kind: "h3" }, { kind: "ul", items: 4, className: "mt-3 list-disc space-y-3 pl-5" }, { kind: "h3" }, { kind: "ul", items: 5, className: "mt-3 list-disc space-y-3 pl-5" }],
  "manage": [{ kind: "p", className: "mt-4" }, { kind: "p" }],
  "donations": [{ kind: "p", className: "mt-4" }, { kind: "ol", items: 4 }, { kind: "p", className: "mt-4" }, { kind: "node", node: nodes.donationCode }, { kind: "p", className: "mt-3 text-sm text-ink-soft" }],
  "let-people-find-you": [{ kind: "p", className: "mt-4" }, { kind: "ol", items: 2 }],
  "limits": [{ kind: "ul", items: 4 }, { kind: "p", className: "mt-4" }, { kind: "p", className: "mt-4" }],
});

export default async function PaymentButtonsGuide() {
  const { t } = await getI18n();
  const blocks = sectionBlocks({
    buttonCode: <CopyCodeBlock className={codeClass}>{paymentButtonHtml("https://checkout.example/pay/YOUR_PUBLIC_TOKEN")}</CopyCodeBlock>,
    donationCode: <CopyCodeBlock className={codeClass}>{paymentButtonHtml("https://checkout.example/pay/YOUR_DONATION_LINK_TOKEN", { text: t(`${k}.donateButton`), sub: DEFAULT_BUTTON_SUB, theme: "dark" })}</CopyCodeBlock>,
  });
  return <main id="main-content" tabIndex={-1} className="reference-page px-[6vw] pb-20 pt-8 text-ink"><div className="mx-auto w-full max-w-5xl">
    <PageIntroBand eyebrow={t(`${k}.eyebrow`)} id="payment-buttons-title" title={t(`${k}.title`)} description={<p>{t(`${k}.intro`)}</p>} />
    <GuideContents label={t(`${k}.sectionsLabel`)} entries={sections.map((id) => ({ href: `#${id}`, label: t(`${k}.nav.${id}`) }))} />
    <div className="mt-8 grid gap-6">
      {sections.map((id) => (
        <section key={id} id={id} aria-labelledby={`${id}-title`} className={sectionClass}>
          <h2 id={`${id}-title`} className="font-sans text-2xl font-semibold">{t(`${k}.${id}.title`)}</h2>
          <GuideBlocks blocks={blocks[id]} prefix={`${k}.${id}.body`} t={t} tags={tags} />
        </section>
      ))}
    </div>
  </div></main>;
}
