import Link from "next/link";
import { utcTimestamp } from "../lib/timestamps";
import { getI18n } from "../lib/i18n/server";
import { formatXmrAmount } from "../lib/formatting";
import Image from "next/image";
import { cookies } from "next/headers";
import { badgeHtml, badgeImageUrl, paymentButtonHtml, paymentButtonImageUrl } from "../lib/payment-button";
import InvoiceAddressAvailability from "./invoice-address-availability";
import StatusRefreshButton from "./status-refresh-button";
import CopyCodeBlock from "./copy-code-block";
import PaymentLinkEditor, { type PaymentLinkData } from "./payment-link-editor";

export default async function PaymentLinks() {
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
  const usage = usageResponse?.ok ? await usageResponse.json() : null;
  const addressStatus = addressResponse?.ok ? await addressResponse.json() : null;
  const currencies: string[] | null = usage?.supported_currencies ?? null;
  const links: PaymentLinkData[] = await response.json();
  const target = profile?.ok ? (await profile.json()).default_confirmation_target : 1;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost";
  const codeClass = "overflow-x-auto rounded-xl bg-ink p-5 pt-16 font-mono text-sm text-cream";
  return <section className="grid min-w-0 gap-6">
    <div><h1 className="font-sans text-2xl font-semibold sm:text-3xl">{t("paymentLinks.title")}</h1>
      <p className="mt-2 text-ink-soft">{t("paymentLinks.intro")}</p>
      <p className="mt-2 text-sm text-ink-soft">{t("paymentLinks.allowanceNote")}</p>
      <p className="mt-2 text-sm text-ink-soft">{t("paymentLinks.donationTip")}</p>
      <p className="mt-3"><Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/monero-payment-buttons">{t("paymentLinks.guide")}</Link></p>
    </div>
    <section aria-labelledby="accept-monero-title" className="grid min-w-0 gap-4 rounded-2xl border border-stroke p-5">
      <h2 id="accept-monero-title" className="text-xl font-semibold">{t("paymentLinks.acceptTitle")}</h2>
      <p className="text-sm text-ink-soft">{t("paymentLinks.badgeIntro")}</p>
      {(["dark", "light"] as const).map(variant => <div key={variant} className="grid min-w-0 gap-3">
        <p>{variant === "dark" ? t("paymentLinks.darkBadge") : t("paymentLinks.lightBadge")}</p>
        <div className={`grid min-w-0 justify-items-start rounded-xl border border-stroke p-4 ${variant === "dark" ? "bg-white/50" : "bg-ink"}`}>
          <Image src={new URL(badgeImageUrl(siteUrl, variant)).pathname} alt={t("paymentLinks.badgeAlt")} width={320} height={80} unoptimized className="h-auto max-w-full" />
        </div>
        <CopyCodeBlock className={codeClass} label={variant === "dark" ? t("paymentLinks.darkBadgeHtml") : t("paymentLinks.lightBadgeHtml")}>{badgeHtml(siteUrl, variant)}</CopyCodeBlock>
      </div>)}
    </section>
    <section aria-label={t("paymentLinks.allowance")} className="rounded-2xl border border-stroke p-5">
      <h3 className="text-xl font-semibold">{t("paymentLinks.allowance")}</h3>
      {usage ? <><p className="mt-3">{t("paymentLinks.allowanceSummary", { remaining: usage.remaining, used: usage.used, limit: usage.daily_limit, hours: usage.window_hours })}</p><p className="mt-2 break-words text-sm">{t("refresh.retrieved")} <time dateTime={usage.retrieved_at}>{utcTimestamp(usage.retrieved_at, t)}</time></p></> : <p role="status">{t("paymentLinks.allowanceUnavailable")}</p>}
      <p className="my-3 text-sm">{t("paymentLinks.sharedNote")}</p>
      <StatusRefreshButton label={t("paymentLinks.refreshAllowance")} />
    </section>
    <InvoiceAddressAvailability status={addressStatus} showRefresh={false} compact={Boolean(addressStatus && addressStatus.counts.never_issued + addressStatus.counts.eligible_for_reuse > 0 && addressStatus.counts.needs_review === 0 && addressStatus.snapshot?.outcome !== "failed")} />
    <details className="rounded-2xl border border-stroke p-5"><summary className="min-h-11 cursor-pointer font-semibold">{t("paymentLinks.create")}</summary><PaymentLinkEditor currencies={currencies} defaultTarget={target} /></details>
    {links.length === 0 ? <p>{t("paymentLinks.none")}</p> : links.map(link => <article key={link.id} className="grid min-w-0 gap-4 rounded-2xl border border-stroke p-5">
      <h3 className="break-words text-xl font-semibold">{link.title} · {link.enabled ? t("terminals.enabled") : t("terminals.disabled")}</h3>
      <p>{link.customer_amount ? `${t("paymentLinks.customerAmount")}${link.minimum_amount_xmr ? ` · ${t("paymentLinks.minimum", { amount: formatXmrAmount(link.minimum_amount_xmr) })}` : ""}` : link.amount_xmr ? `${link.amount_xmr} XMR` : t("paymentLink.fiatReference", { amount: link.amount_fiat ?? "", currency: link.currency ?? "" })}</p>
      <p>{t("paymentLinks.reusable")}</p><CopyCodeBlock className={codeClass}>{link.url}</CopyCodeBlock>
      <div className="grid min-w-0 gap-3">
        <p>{t("paymentLinks.htmlButton")}</p>
        <div className="grid min-w-0 justify-items-start gap-3 rounded-xl border border-stroke bg-white/50 p-4">
          <p className="text-sm text-ink-soft">{t("paymentLinks.buttonPreview")}</p>
          <a href={link.url} className="inline-block max-w-full rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay">
            <Image src={paymentButtonImageUrl(link.url, link.button_text)} alt={t("paymentLinks.buttonAlt", { text: link.button_text })} width={280} height={80} unoptimized className="h-auto max-w-full" />
          </a>
          <p className="text-sm text-ink-soft">{link.auto_create_invoice ? t("paymentLinks.autoCreates") : t("paymentLinks.opensReview")}</p>
        </div>
        <CopyCodeBlock className={codeClass}>{paymentButtonHtml(link.url, link.button_text)}</CopyCodeBlock>
      </div>
      <p className="text-sm text-ink-soft">{t("paymentLinks.pasteHtml", { behavior: link.auto_create_invoice ? t("paymentLinks.graphicAuto") : t("paymentLinks.graphicReview") })}</p>
      <p><Link className="font-semibold underline decoration-clay underline-offset-4" href={`/dashboard/payment-links/${encodeURIComponent(link.id)}/sign`}>{t("paymentLinks.printable")}</Link></p>
      <details><summary className="min-h-11 cursor-pointer font-semibold">{t("paymentLinks.editSettings")}</summary><PaymentLinkEditor currencies={currencies} link={link} /></details>
    </article>)}
  </section>;
}
