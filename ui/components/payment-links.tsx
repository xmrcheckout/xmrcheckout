import Link from "next/link";
import { utcTimestamp } from "../lib/timestamps";
import { getI18n } from "../lib/i18n/server";
import { formatXmrAmount } from "../lib/formatting";
import Image from "next/image";
import { cookies } from "next/headers";
import { badgeHtml, badgeImageUrl, paymentButtonHtml, paymentButtonImageUrl } from "../lib/payment-button";
import InvoiceAddressAvailability, { type SubaddressStatus } from "./invoice-address-availability";
import StatusRefreshButton from "./status-refresh-button";
import StatusBadge from "./status-badge";
import CopyCodeBlock from "./copy-code-block";
import CopyIconButton from "./copy-icon-button";
import PaymentLinkEditor, { type PaymentLinkData } from "./payment-link-editor";

export type PaymentLinkUsage = { remaining: number; used: number; daily_limit: number; window_hours: number; retrieved_at: string; supported_currencies?: string[] };

type Translate = Awaited<ReturnType<typeof getI18n>>["t"];
type Mode = "live" | "tour";

const codeClass = "overflow-x-auto rounded-xl bg-ink p-5 pt-16 font-mono text-sm text-cream";
const linkClass = "font-semibold underline decoration-clay underline-offset-4";
const listHref = (mode: Mode) => mode === "tour" ? "/tour?tab=payment-links" : "/dashboard?tab=payment-links";
const detailHref = (mode: Mode, id: string) => `${listHref(mode)}&link=${encodeURIComponent(id)}`;

const priceLabel = (link: PaymentLinkData, t: Translate) => link.customer_amount
  ? `${t("paymentLinks.customerAmount")}${link.minimum_amount_xmr ? ` · ${t("paymentLinks.minimum", { amount: formatXmrAmount(link.minimum_amount_xmr) })}` : ""}`
  : link.amount_xmr ? `${link.amount_xmr} XMR` : t("paymentLink.fiatReference", { amount: link.amount_fiat ?? "", currency: link.currency ?? "" });

const statusBadge = (link: PaymentLinkData, t: Translate) =>
  <StatusBadge label={link.enabled ? t("terminals.enabled") : t("terminals.disabled")} tone={link.enabled ? "success" : "neutral"} />;

export default async function PaymentLinks({ selectedId }: { selectedId?: string }) {
  const { t } = await getI18n();
  const key = (await cookies()).get("xmrcheckout_api_key")?.value;
  const base = process.env.API_BASE_URL ?? "http://localhost:8000";
  const headers = { Authorization: `ApiKey ${key}` };
  const [response, profile, usageResponse, addressResponse] = await Promise.all([
    fetch(`${base}/api/core/payment-links`, { headers, cache: "no-store" }).catch(() => null),
    fetch(`${base}/api/core/profile`, { headers, cache: "no-store" }).catch(() => null),
    fetch(`${base}/api/core/payment-links/status`, { headers, cache: "no-store" }).catch(() => null),
    fetch(`${base}/api/core/subaddresses/status`, { headers, cache: "no-store" }).catch(() => null),
  ]);
  if (!response?.ok) return <section><h1 className="font-sans text-2xl font-semibold">{t("paymentLinks.title")}</h1><p role="alert">{t("paymentLinks.unavailable")}</p></section>;
  const usage: PaymentLinkUsage | null = usageResponse?.ok ? await usageResponse.json() : null;
  const addressStatus: SubaddressStatus | null = addressResponse?.ok ? await addressResponse.json() : null;
  const links: PaymentLinkData[] = await response.json();
  const target = profile?.ok ? (await profile.json()).default_confirmation_target : 1;
  return <PaymentLinksView links={links} usage={usage} addressStatus={addressStatus} target={target} selectedId={selectedId} />;
}

export async function PaymentLinksView({ links, usage, addressStatus, target, selectedId, mode = "live" }: {
  links: PaymentLinkData[]; usage: PaymentLinkUsage | null; addressStatus: SubaddressStatus | null; target: number; selectedId?: string; mode?: Mode;
}) {
  const { t } = await getI18n();
  const currencies: string[] | null = usage?.supported_currencies ?? null;
  const selected = selectedId ? links.find(link => link.id === selectedId) : undefined;
  if (selected) return <PaymentLinkDetail link={selected} currencies={currencies} mode={mode} t={t} />;
  const tour = mode === "tour";
  const addressesCompact = Boolean(addressStatus && addressStatus.counts.never_issued + addressStatus.counts.eligible_for_reuse > 0 && addressStatus.counts.needs_review === 0 && addressStatus.snapshot?.outcome !== "failed");
  const cell = "block py-1 before:mr-2 before:text-xs before:font-semibold before:uppercase before:tracking-[0.06em] before:text-ink-soft before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-3 sm:align-middle sm:before:content-none";
  return <section className="grid min-w-0 gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-sans text-2xl font-semibold sm:text-3xl">{t("paymentLinks.title")}</h1>
        <p className="mt-2 text-ink-soft">{t("paymentLinks.intro")}</p>
      </div>
    </div>
    {tour ? <p className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">{t("paymentLinks.demoNote")}</p> : null}
    {selectedId ? <p role="status" className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm">{t("paymentLinks.notFound")}</p> : null}

    <details className="rounded-2xl open:border open:border-stroke open:p-5" open={links.length === 0}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-full bg-ink px-5 py-2 font-semibold text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">{t("paymentLinks.create")}</summary>
      <div className="mt-5 grid gap-4">
        <p className="text-sm text-ink-soft">{t("paymentLinks.donationTip")}</p>
        <PaymentLinkEditor currencies={currencies} defaultTarget={target} mode={mode} />
      </div>
    </details>

    <section aria-labelledby="payment-links-list-title" className="grid min-w-0 gap-3">
      <h2 id="payment-links-list-title" className="font-sans text-xl font-semibold">{t("paymentLinks.yourLinks")}</h2>
      {links.length === 0 ? <p>{t("paymentLinks.none")}</p> : <table className="block w-full min-w-0 text-left sm:table">
        <thead className="sr-only sm:not-sr-only sm:table-header-group">
          <tr className="border-b border-stroke text-xs uppercase tracking-[0.06em] text-ink-soft">
            <th scope="col" className="sm:px-3 sm:py-2">{t("paymentLinks.colTitle")}</th>
            <th scope="col" className="sm:px-3 sm:py-2">{t("paymentLinks.colPrice")}</th>
            <th scope="col" className="sm:px-3 sm:py-2">{t("paymentLinks.colStatus")}</th>
            <th scope="col" className="sm:px-3 sm:py-2">{t("paymentLinks.colLink")}</th>
            <th scope="col" className="sm:px-3 sm:py-2"><span className="sr-only">{t("paymentLinks.colActions")}</span></th>
          </tr>
        </thead>
        <tbody className="grid gap-3 sm:table-row-group">
          {links.map(link => <tr key={link.id} className="block rounded-2xl border border-stroke p-4 sm:table-row sm:rounded-none sm:border-0 sm:border-b sm:p-0">
            <th scope="row" className="block break-words py-1 text-left font-semibold sm:table-cell sm:px-3 sm:py-3 sm:align-middle">
              <Link className={linkClass} href={detailHref(mode, link.id)}>{link.title}</Link>
            </th>
            <td data-label={t("paymentLinks.colPrice")} className={cell}>{priceLabel(link, t)}</td>
            <td data-label={t("paymentLinks.colStatus")} className={cell}>{statusBadge(link, t)}</td>
            <td data-label={t("paymentLinks.colLink")} className={cell}>
              <span className="inline-flex items-center gap-2 align-middle">
                <CopyIconButton value={link.url} label={t("paymentLinks.copyLink", { title: link.title })} />
                <a href={tour ? "/tour?tab=invoice" : link.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke bg-white/80 text-ink-soft transition hover:border-ink/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2" aria-label={t("paymentLinks.openLink", { title: link.title })} title={t("paymentLinks.openLink", { title: link.title })}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              </span>
            </td>
            <td className="block pt-2 sm:table-cell sm:px-3 sm:py-3 sm:text-right sm:align-middle">
              <Link className="inline-flex min-h-11 items-center rounded-full border border-stroke px-4 py-2 text-sm font-semibold transition hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50" href={detailHref(mode, link.id)} aria-label={t("paymentLinks.manageLabel", { title: link.title })}>{t("paymentLinks.manage")}</Link>
            </td>
          </tr>)}
        </tbody>
      </table>}
    </section>

    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section aria-label={t("paymentLinks.allowance")} className="min-w-0 rounded-surface border border-stroke bg-white/70 p-4 shadow-soft">
        <h2 className="font-sans text-sm font-semibold">{t("paymentLinks.allowance")}</h2>
        {usage ? <><p className="mt-1 text-sm">{t("paymentLinks.allowanceSummary", { remaining: usage.remaining, used: usage.used, limit: usage.daily_limit, hours: usage.window_hours })}</p><p className="mt-2 break-words text-xs text-ink-soft">{t("refresh.retrieved")} <time dateTime={usage.retrieved_at}>{utcTimestamp(usage.retrieved_at, t)}</time></p></> : <p role="status" className="mt-1 text-sm">{t("paymentLinks.allowanceUnavailable")}</p>}
        {tour ? null : <div className="mt-3"><StatusRefreshButton label={t("paymentLinks.refreshAllowance")} /></div>}
      </section>
      {tour ? null : <InvoiceAddressAvailability status={addressStatus} showRefresh={false} compact={addressesCompact} />}
    </div>

    <details className="text-sm text-ink-soft">
      <summary className="inline-flex min-h-11 cursor-pointer items-center py-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50">{t("paymentLinks.aboutLimits")}</summary>
      <div className="mt-1 grid gap-2">
        <p>{t("paymentLinks.allowanceNote")}</p>
        <p>{t("paymentLinks.sharedNote")}</p>
        <p>{t("paymentLinks.allowanceNoteDetail")}</p>
        <p><Link className={linkClass} href="/guides/monero-payment-buttons">{t("paymentLinks.guide")}</Link></p>
      </div>
    </details>
  </section>;
}

function PaymentLinkDetail({ link, currencies, mode, t }: { link: PaymentLinkData; currencies: string[] | null; mode: Mode; t: Translate }) {
  const tour = mode === "tour";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost";
  const sectionClass = "grid min-w-0 gap-3 rounded-2xl border border-stroke p-5";
  const badgeVariant = (variant: "dark" | "light") => <div className="grid min-w-0 gap-3">
    <div className={`grid min-w-0 justify-items-start rounded-xl border border-stroke p-4 ${variant === "dark" ? "bg-white/50" : "bg-ink"}`}>
      <a href={tour ? "/tour?tab=invoice" : link.url} className="inline-block max-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay">
        <Image src={new URL(badgeImageUrl(siteUrl, variant)).pathname} alt={t("paymentLinks.badgeAlt")} width={320} height={80} unoptimized className="h-auto w-64 max-w-full" />
      </a>
    </div>
    <CopyCodeBlock className={codeClass} label={variant === "dark" ? t("paymentLinks.darkBadgeHtml") : t("paymentLinks.lightBadgeHtml")}>{badgeHtml(siteUrl, variant, link.url)}</CopyCodeBlock>
  </div>;
  return <section className="grid min-w-0 gap-6">
    <div>
      <p><Link className={`inline-flex min-h-11 items-center ${linkClass}`} href={listHref(mode)}><span aria-hidden="true">←&nbsp;</span>{t("paymentLinks.back")}</Link></p>
      <h1 className="mt-2 break-words font-sans text-2xl font-semibold sm:text-3xl">{link.title}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-3">{statusBadge(link, t)}<span>{priceLabel(link, t)}</span></p>
    </div>
    {tour ? <p className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">{t("paymentLinks.demoNote")}</p> : null}

    <section aria-labelledby="payment-link-share-title" className="grid min-w-0 gap-4">
      <div>
        <h2 id="payment-link-share-title" className="font-sans text-xl font-semibold">{t("paymentLinks.share")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("paymentLinks.shareIntro")}</p>
      </div>
      <section aria-labelledby="share-link-title" className={sectionClass}>
        <h3 id="share-link-title" className="font-sans font-semibold">{t("paymentLinks.shareLink")}</h3>
        <p className="text-sm text-ink-soft">{t("paymentLinks.shareLinkHelp")}</p>
        <CopyCodeBlock className={codeClass} label={t("paymentLinks.reusable")}>{link.url}</CopyCodeBlock>
      </section>
      <section aria-labelledby="share-button-title" className={sectionClass}>
        <h3 id="share-button-title" className="font-sans font-semibold">{t("paymentLinks.shareButton")}</h3>
        <div className="grid min-w-0 justify-items-start gap-3 rounded-xl border border-stroke bg-white/50 p-4">
          <p className="text-sm text-ink-soft">{t("paymentLinks.buttonPreview")}</p>
          <a href={tour ? "/tour?tab=invoice" : link.url} className="inline-block max-w-full rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay">
            <Image src={paymentButtonImageUrl(link.url, link.button_text)} alt={t("paymentLinks.buttonAlt", { text: link.button_text })} width={280} height={80} unoptimized className="h-auto max-w-full" />
          </a>
          <p className="text-sm text-ink-soft">{link.auto_create_invoice ? t("paymentLinks.autoCreates") : t("paymentLinks.opensReview")}</p>
        </div>
        <CopyCodeBlock className={codeClass} label={t("paymentLinks.htmlButton")}>{paymentButtonHtml(link.url, link.button_text)}</CopyCodeBlock>
        <p className="text-sm text-ink-soft">{t("paymentLinks.pasteHtml", { behavior: link.auto_create_invoice ? t("paymentLinks.graphicAuto") : t("paymentLinks.graphicReview") })}</p>
      </section>
      <section aria-labelledby="share-badge-title" className={sectionClass}>
        <h3 id="share-badge-title" className="font-sans font-semibold">{t("paymentLinks.shareBadge")}</h3>
        <p className="text-sm text-ink-soft">{t("paymentLinks.badgeHelp")}</p>
        {badgeVariant("dark")}
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50">{t("paymentLinks.lightBadge")}</summary>
          {badgeVariant("light")}
        </details>
      </section>
      {tour ? null : <section aria-labelledby="share-sign-title" className={sectionClass}>
        <h3 id="share-sign-title" className="font-sans font-semibold">{t("paymentLinks.shareSign")}</h3>
        <p className="text-sm text-ink-soft">{t("paymentLinks.shareSignHelp")}</p>
        <p><Link className={linkClass} href={`/dashboard/payment-links/${encodeURIComponent(link.id)}/sign`}>{t("paymentLinks.printable")}</Link></p>
      </section>}
    </section>

    <section aria-labelledby="payment-link-settings-title" className={sectionClass}>
      <h2 id="payment-link-settings-title" className="font-sans text-xl font-semibold">{t("paymentLinks.settings")}</h2>
      <PaymentLinkEditor currencies={currencies} link={link} mode={mode} />
    </section>
  </section>;
}
