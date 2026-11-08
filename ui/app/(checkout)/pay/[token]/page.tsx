import AutomaticPaymentLink from "../../../../components/automatic-payment-link";
import CustomerAmountForm, { type AmountError } from "../../../../components/customer-amount-form";
import { notFound } from "next/navigation";
import { formatFiatAmount, formatXmrAmount } from "../../../../lib/formatting";
import { getI18n } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("paymentLink.metaTitle"), robots: { index: false, follow: false } };
}
export default async function PaymentLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  // Set by the API when it sends a rejected amount back to this page.
  const amountError: AmountError | null = error === "amount" || error === "minimum" ? error : null;
  const { t, locale } = await getI18n();
  const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:8000"}/api/core/public/payment-links/${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
  if (response?.status === 404) notFound();
  if (!response?.ok) return <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 py-16"><h1 className="font-sans text-2xl font-semibold">{t("paymentLink.checkoutUnavailable")}</h1><p>{t("paymentLink.checkoutUnavailableHelp")}</p></main>;
  const link = await response.json();
  return <main id="main-content" tabIndex={-1} className="mx-auto grid w-full max-w-2xl gap-5 px-6 py-16">
    <h1 className="font-sans break-words text-3xl font-semibold">{link.title}</h1>
    <p className="whitespace-pre-wrap break-words">{link.description}</p>
    {link.customer_amount ? <CustomerAmountForm link={link} initialError={amountError} /> : <>
    <p className="text-xl">{link.amount_xmr ? `${formatXmrAmount(link.amount_xmr)} XMR` : t("pay.merchantPrice", { price: formatFiatAmount(link.amount_fiat, link.currency, locale) })}</p>
    {link.amount_fiat ? <p>{t("paymentLink.fiatNote")}</p> : null}
    <p>{t("paymentLink.directToWallet", { target: link.confirmation_target })}</p>
    {link.auto_create_invoice ? <AutomaticPaymentLink token={token} actionUrl={link.action_url} /> : null}
    <div className={link.auto_create_invoice ? "automatic-review" : undefined}>
    <form method="post" action={link.action_url}><button className="min-h-11 rounded-full bg-ink px-6 py-3 text-cream">{t("paymentLink.create")}</button></form>
    <p className="text-sm text-ink-soft">{t("paymentLink.separateInvoicesDelivery")}</p>
    </div></>}
  </main>;
}
