import AutomaticPaymentLink from "../../../../components/automatic-payment-link";
import { notFound } from "next/navigation";
import { formatXmrAmount } from "../../../../lib/formatting";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase with Monero", robots: { index: false, follow: false } };
export default async function PaymentLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:8000"}/api/core/public/payment-links/${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
  if (response?.status === 404) notFound();
  if (!response?.ok) return <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-2xl font-semibold">Checkout unavailable</h1><p>Refresh to try again. No invoice has been requested from this page.</p></main>;
  const link = await response.json();
  return <main id="main-content" tabIndex={-1} className="mx-auto grid w-full max-w-2xl gap-5 px-6 py-16">
    <h1 className="break-words text-3xl font-semibold">{link.title}</h1>
    <p className="whitespace-pre-wrap break-words">{link.description}</p>
    {link.customer_amount ? <CustomerAmountForm link={link} /> : <>
    <p className="text-xl">{link.amount_xmr ? `${link.amount_xmr} XMR` : `${link.amount_fiat} ${link.currency} reference`}</p>
    {link.amount_fiat ? <p>The XMR amount is calculated when your invoice is created. The estimate does not lock a rate or guarantee a fiat outcome. The invoice shows its quote source and timestamp.</p> : null}
    <p>Payment goes directly to the merchant’s wallet. Required confirmations: {link.confirmation_target}.</p>
    {link.auto_create_invoice ? <AutomaticPaymentLink token={token} actionUrl={link.action_url} /> : null}
    <div className={link.auto_create_invoice ? "automatic-review" : undefined}>
    <form method="post" action={link.action_url}><button className="min-h-11 rounded-full bg-ink px-6 py-3 text-cream">Create invoice and pay with Monero</button></form>
    <p className="text-sm text-ink-soft">Each submission creates a separate invoice. Keep the invoice URL and share its ID with the merchant to arrange delivery. If creation is interrupted, contact the merchant before submitting again.</p>
    </div></>}
  </main>;
}

type CustomerAmountLink = { action_url: string; confirmation_target: number; minimum_amount_xmr: string | null; supported_currencies?: string[] };
function CustomerAmountForm({ link }: { link: CustomerAmountLink }) {
  const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-ink";
  return <>
    <form method="post" action={link.action_url} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div><label htmlFor="customer-amount">Amount</label><input id="customer-amount" name="amount" type="text" inputMode="decimal" pattern="[0-9]{1,7}([.][0-9]{1,12})?" autoComplete="off" required aria-describedby="customer-amount-help" className={inputClass} /></div>
        <div><label htmlFor="customer-currency">Currency</label><select id="customer-currency" name="currency" defaultValue="XMR" className={inputClass}><option>XMR</option>{(link.supported_currencies ?? []).map(currency => <option key={currency}>{currency}</option>)}</select></div>
      </div>
      <p id="customer-amount-help" className="text-sm text-ink-soft">Enter a number such as 0.05. XMR allows up to 12 decimal places; fiat-reference amounts allow 2.{link.minimum_amount_xmr ? ` Minimum: ${formatXmrAmount(link.minimum_amount_xmr)} XMR. Fiat-reference amounts are compared after conversion.` : ""}</p>
      <p>Fiat-reference amounts are converted to XMR when your invoice is created. The estimate does not lock a rate or guarantee a fiat outcome. The invoice shows its quote source and timestamp.</p>
      <p>Payment goes directly to the merchant’s wallet. Required confirmations: {link.confirmation_target}.</p>
      <button className="min-h-11 justify-self-start rounded-full bg-ink px-6 py-3 text-cream">Create invoice and pay with Monero</button>
    </form>
    <p className="text-sm text-ink-soft">Each submission creates a separate invoice. Keep the invoice URL and share its ID with the merchant if needed. If creation is interrupted, contact the merchant before submitting again.</p>
  </>;
}
