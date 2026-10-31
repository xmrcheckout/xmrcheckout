import AutomaticPaymentLink from "../../../../components/automatic-payment-link";
import { notFound } from "next/navigation";

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
    <p className="text-xl">{link.amount_xmr ? `${link.amount_xmr} XMR` : `${link.amount_fiat} ${link.currency} reference`}</p>
    {link.amount_fiat ? <p>The XMR amount is calculated when your invoice is created. The estimate does not lock a rate or guarantee a fiat outcome. The invoice shows its quote source and timestamp.</p> : null}
    <p>Payment goes directly to the merchant’s wallet. Required confirmations: {link.confirmation_target}.</p>
    {link.auto_create_invoice ? <AutomaticPaymentLink token={token} actionUrl={link.action_url} /> : null}
    <div className={link.auto_create_invoice ? "automatic-review" : undefined}>
    <form method="post" action={link.action_url}><button className="min-h-11 rounded-full bg-ink px-6 py-3 text-cream">Create invoice and pay with Monero</button></form>
    <p className="text-sm text-ink-soft">Each submission creates a separate invoice. Keep the invoice URL and share its ID with the merchant to arrange delivery. If creation is interrupted, contact the merchant before submitting again.</p>
    </div>
  </main>;
}
