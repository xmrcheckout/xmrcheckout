import AutomaticPaymentLink from "../../../../components/automatic-payment-link";
import { notFound } from "next/navigation";
import { formatFiatAmount, formatXmrAmount } from "../../../../lib/formatting";
import { getI18n } from "../../../../lib/i18n/server";
import type { Translate } from "../../../../lib/i18n/translate";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("paymentLink.metaTitle"), robots: { index: false, follow: false } };
}
export default async function PaymentLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, locale } = await getI18n();
  const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:8000"}/api/core/public/payment-links/${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
  if (response?.status === 404) notFound();
  if (!response?.ok) return <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-2xl font-semibold">{t("paymentLink.checkoutUnavailable")}</h1><p>{t("paymentLink.checkoutUnavailableHelp")}</p></main>;
  const link = await response.json();
  return <main id="main-content" tabIndex={-1} className="mx-auto grid w-full max-w-2xl gap-5 px-6 py-16">
    <h1 className="break-words text-3xl font-semibold">{link.title}</h1>
    <p className="whitespace-pre-wrap break-words">{link.description}</p>
    {link.customer_amount ? <CustomerAmountForm link={link} t={t} /> : <>
    <p className="text-xl">{link.amount_xmr ? `${link.amount_xmr} XMR` : t("pay.merchantPrice", { price: formatFiatAmount(link.amount_fiat, link.currency, locale) })}</p>
    {link.amount_fiat ? <p>{t("paymentLink.fiatNote")}</p> : null}
    <p>{t("paymentLink.directToWallet", { target: link.confirmation_target })}</p>
    {link.auto_create_invoice ? <AutomaticPaymentLink token={token} actionUrl={link.action_url} /> : null}
    <div className={link.auto_create_invoice ? "automatic-review" : undefined}>
    <form method="post" action={link.action_url}><button className="min-h-11 rounded-full bg-ink px-6 py-3 text-cream">{t("paymentLink.create")}</button></form>
    <p className="text-sm text-ink-soft">{t("paymentLink.separateInvoicesDelivery")}</p>
    </div></>}
  </main>;
}

type CustomerAmountLink = { action_url: string; confirmation_target: number; minimum_amount_xmr: string | null; supported_currencies?: string[] };
function CustomerAmountForm({ link, t }: { link: CustomerAmountLink; t: Translate }) {
  const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-ink";
  return <>
    <form method="post" action={link.action_url} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div><label htmlFor="customer-amount">{t("paymentLink.amount")}</label><input id="customer-amount" name="amount" type="text" inputMode="decimal" pattern="[0-9]{1,7}([.][0-9]{1,12})?" autoComplete="off" required aria-describedby="customer-amount-help" className={inputClass} /></div>
        <div><label htmlFor="customer-currency">{t("paymentLink.currency")}</label><select id="customer-currency" name="currency" defaultValue="XMR" className={inputClass}><option>XMR</option>{(link.supported_currencies ?? []).map(currency => <option key={currency}>{currency}</option>)}</select></div>
      </div>
      <p id="customer-amount-help" className="text-sm text-ink-soft">{t("paymentLink.amountHelp")}{link.minimum_amount_xmr ? ` ${t("paymentLink.minimum", { amount: formatXmrAmount(link.minimum_amount_xmr) })}` : ""}</p>
      <p>{t("paymentLink.customerFiatNote")}</p>
      <p>{t("paymentLink.directToWallet", { target: link.confirmation_target })}</p>
      <button className="min-h-11 justify-self-start rounded-full bg-ink px-6 py-3 text-cream">{t("paymentLink.create")}</button>
    </form>
    <p className="text-sm text-ink-soft">{t("paymentLink.separateInvoices")}</p>
  </>;
}
