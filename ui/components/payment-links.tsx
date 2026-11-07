import Link from "next/link";
import { redirect } from "next/navigation";
import { utcTimestamp } from "../lib/timestamps";
import { getI18n } from "../lib/i18n/server";
import { formatXmrAmount } from "../lib/formatting";
import { cookies } from "next/headers";
import InvoiceAddressAvailability, { type SubaddressStatus } from "./invoice-address-availability";
import StatusRefreshButton from "./status-refresh-button";
import StatusBadge from "./status-badge";
import CopyIconButton from "./copy-icon-button";
import PaymentLinkEditor, { type PaymentLinkData } from "./payment-link-editor";
import PaymentButtonEditor from "./payment-button-editor";
import DetailTabs, { type DetailTab } from "./detail-tabs";
import { PrintSignButton, SignEditor } from "./payment-link-sign";
import { signXmrAmount } from "../lib/payment-button";

export type PaymentLinkUsage = { remaining: number; used: number; daily_limit: number; window_hours: number; retrieved_at: string; supported_currencies?: string[] };

type Translate = Awaited<ReturnType<typeof getI18n>>["t"];
type Mode = "live" | "tour";

const linkClass = "font-semibold underline decoration-clay underline-offset-4";
const listHref = (mode: Mode) => mode === "tour" ? "/tour?tab=payment-links" : "/dashboard?tab=payment-links";
const detailHref = (mode: Mode, id: string) => `${listHref(mode)}&link=${encodeURIComponent(id)}`;

const priceLabel = (link: PaymentLinkData, t: Translate) => link.customer_amount
  ? `${t("paymentLinks.customerAmount")}${link.minimum_amount_xmr ? ` · ${t("paymentLinks.minimum", { amount: formatXmrAmount(link.minimum_amount_xmr) })}` : ""}`
  : link.amount_xmr ? `${formatXmrAmount(link.amount_xmr)} XMR` : t("paymentLink.fiatReference", { amount: link.amount_fiat ?? "", currency: link.currency ?? "" });

const statusBadge = (link: PaymentLinkData, t: Translate) =>
  <StatusBadge label={link.enabled ? t("terminals.enabled") : t("terminals.disabled")} tone={link.enabled ? "success" : "neutral"} />;

export default async function PaymentLinks({ selectedId, deleted, saved, loginUrl }: { selectedId?: string; deleted?: boolean; saved?: boolean; loginUrl: string }) {
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
  if ([response, profile, usageResponse, addressResponse].some(result => result?.status === 401)) redirect(loginUrl);
  if (!response?.ok) return <section><h1 className="font-sans text-2xl font-semibold">{t("paymentLinks.title")}</h1><p role="alert">{t("paymentLinks.unavailable")}</p></section>;
  const usage: PaymentLinkUsage | null = usageResponse?.ok ? await usageResponse.json() : null;
  const addressStatus: SubaddressStatus | null = addressResponse?.ok ? await addressResponse.json() : null;
  const links: PaymentLinkData[] = await response.json();
  const target = profile?.ok ? (await profile.json()).default_confirmation_target : 1;
  return <PaymentLinksView links={links} usage={usage} addressStatus={addressStatus} target={target} selectedId={selectedId} deleted={deleted} saved={saved} />;
}

export async function PaymentLinksView({ links, usage, addressStatus, target, selectedId, deleted = false, saved = false, mode = "live" }: {
  links: PaymentLinkData[]; usage: PaymentLinkUsage | null; addressStatus: SubaddressStatus | null; target: number; selectedId?: string; deleted?: boolean; saved?: boolean; mode?: Mode;
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
    {deleted && !selectedId ? <p role="status" className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm">{t("dashboard.paymentLinkActions.deleted")}</p> : null}
    {saved && !selectedId ? <p role="status" className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm">{t("dashboard.paymentLinkActions.saved")}</p> : null}

    <details className="rounded-2xl open:border open:border-stroke open:p-5">
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
            <td data-label={t("paymentLinks.colStatus")} className={`${cell} whitespace-nowrap`}>{statusBadge(link, t)}</td>
            <td data-label={t("paymentLinks.colLink")} className={cell}>
              <span className="inline-flex items-center gap-2 align-middle">
                <CopyIconButton value={link.url} label={t("paymentLinks.copyLink", { title: link.title })} />
                <a href={tour ? "/tour?tab=invoice" : link.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-white/80 text-ink-soft transition hover:border-ink/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2" aria-label={t("paymentLinks.openLink", { title: link.title })} title={t("paymentLinks.openLink", { title: link.title })}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              </span>
            </td>
            <td className="block whitespace-nowrap pt-2 sm:table-cell sm:px-3 sm:py-3 sm:text-right sm:align-middle">
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
  const panelClass = "grid min-w-0 gap-3";
  const signPrice = signXmrAmount(link);
  const tabs: DetailTab[] = [
    { id: "settings", label: t("paymentLinks.settings"), content: <PaymentLinkEditor currencies={currencies} link={link} mode={mode} /> },
    { id: "button", label: t("paymentLinks.shareButton"), content: <div className={panelClass}>
      <PaymentButtonEditor url={link.url} initialText={link.button_text} previewHref={tour ? "/tour?tab=invoice" : link.url} autoCreate={link.auto_create_invoice} />
    </div> },
    { id: "sign", label: t("paymentLinks.shareSign"), content: <div className={panelClass}>
      <p className="text-sm text-ink-soft">{t("paymentLinks.signPage.help")}</p>
      {!link.enabled ? <p role="alert" className="rounded-xl border border-clay p-3">{t("paymentLinks.signPage.disabled")}</p> : null}
      <div><PrintSignButton /></div>
      <SignEditor url={link.url} title={link.title} price={signPrice ? `${formatXmrAmount(signPrice)} XMR` : null} />
    </div> },
  ];
  return <section className="grid min-w-0 gap-6">
    <div>
      <p><Link className={`inline-flex min-h-11 items-center ${linkClass}`} href={listHref(mode)}><span aria-hidden="true">←&nbsp;</span>{t("paymentLinks.back")}</Link></p>
      <h1 id="payment-link-title" className="mt-2 break-words font-sans text-2xl font-semibold sm:text-3xl">{link.title}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-3">{statusBadge(link, t)}<span>{priceLabel(link, t)}</span></p>
      <p className="mt-2 text-sm text-ink-soft">{t("paymentLinks.shareIntro")}</p>
    </div>
    {tour ? <p className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">{t("paymentLinks.demoNote")}</p> : null}
    <DetailTabs tabs={tabs} labelledBy="payment-link-title" />
  </section>;
}
