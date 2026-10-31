import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { paymentButtonHtml, paymentButtonImageUrl } from "../lib/payment-button";
import InvoiceAddressAvailability from "./invoice-address-availability";
import StatusRefreshButton from "./status-refresh-button";
import CopyCodeBlock from "./copy-code-block";
import PaymentLinkEditor, { type PaymentLinkData } from "./payment-link-editor";

export default async function PaymentLinks() {
  const key = (await cookies()).get("xmrcheckout_api_key")?.value;
  const base = process.env.API_BASE_URL ?? "http://localhost:8000";
  const headers = { Authorization: `ApiKey ${key}` };
  const [response, profile, usageResponse, addressResponse] = await Promise.all([
    fetch(`${base}/api/core/payment-links`, { headers, cache: "no-store" }).catch(() => null),
    fetch(`${base}/api/core/profile`, { headers, cache: "no-store" }).catch(() => null),
    fetch(`${base}/api/core/payment-links/status`, { headers, cache: "no-store" }).catch(() => null),
    fetch(`${base}/api/core/subaddresses/status`, { headers, cache: "no-store" }).catch(() => null),
  ]);
  if (!response?.ok) return <p role="alert">Payment links are unavailable. Refresh to try again.</p>;
  const usage = usageResponse?.ok ? await usageResponse.json() : null;
  const addressStatus = addressResponse?.ok ? await addressResponse.json() : null;
  const currencies: string[] | null = usage?.supported_currencies ?? null;
  const links: PaymentLinkData[] = await response.json();
  const target = profile?.ok ? (await profile.json()).default_confirmation_target : 1;
  const codeClass = "overflow-x-auto rounded-xl bg-ink p-5 pt-16 font-mono text-sm text-cream";
  return <section className="grid min-w-0 gap-6">
    <div><h2 className="text-2xl font-semibold">Payment links</h2>
      <p className="mt-2 text-ink-soft">Create a reusable button for a fixed amount. Each submission creates a separate XMR invoice paid directly to your wallet.</p>
      <p className="mt-2 text-sm text-ink-soft">Public invoice creation has a daily allowance and shares your address capacity. Repeated submissions can create separate invoices. No buyer details are collected; arrange fulfillment with your customer using the invoice ID. Return URLs do not protect downloads.</p>
      <p className="mt-3"><Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/monero-payment-buttons">Payment link setup guide</Link></p>
    </div>
    <section aria-label="Public invoice allowance" className="rounded-2xl border border-stroke p-5">
      <h3 className="text-xl font-semibold">Public invoice allowance</h3>
      {usage ? <><p className="mt-3">{usage.remaining} remaining · {usage.used} used · Limit {usage.daily_limit} per rolling {usage.window_hours} hours</p><p className="mt-2 break-words text-sm">Status retrieved: {usage.retrieved_at}</p></> : <p role="status">Allowance unavailable. Refresh to try again.</p>}
      <p className="my-3 text-sm">Allowance and address capacity are shared across your payment links. These snapshots do not reserve capacity.</p>
      <StatusRefreshButton label="Refresh allowance and addresses" />
    </section>
    <InvoiceAddressAvailability status={addressStatus} showRefresh={false} />
    <details className="rounded-2xl border border-stroke p-5"><summary className="min-h-11 cursor-pointer font-semibold">Create payment link</summary><PaymentLinkEditor currencies={currencies} defaultTarget={target} /></details>
    {links.length === 0 ? <p>No payment links yet.</p> : links.map(link => <article key={link.id} className="grid min-w-0 gap-4 rounded-2xl border border-stroke p-5">
      <h3 className="break-words text-xl font-semibold">{link.title} · {link.enabled ? "Enabled" : "Disabled"}</h3>
      <p>{link.amount_xmr ? `${link.amount_xmr} XMR` : `${link.amount_fiat} ${link.currency} reference`}</p>
      <p>Reusable link</p><CopyCodeBlock className={codeClass}>{link.url}</CopyCodeBlock>
      <div className="grid min-w-0 gap-3">
        <p>HTML button</p>
        <div className="grid min-w-0 justify-items-start gap-3 rounded-xl border border-stroke bg-white/50 p-4">
          <p className="text-sm text-ink-soft">Button preview</p>
          <a href={link.url} className="inline-block max-w-full rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay">
            <Image src={paymentButtonImageUrl(link.url)} alt="Buy with Monero via xmrcheckout" width={280} height={80} unoptimized className="h-auto max-w-full" />
          </a>
          <p className="text-sm text-ink-soft">{link.auto_create_invoice ? "Creates an invoice automatically when opened." : "Opens the payment review page."}</p>
        </div>
        <CopyCodeBlock className={codeClass}>{paymentButtonHtml(link.url)}</CopyCodeBlock>
      </div>
      <p className="text-sm text-ink-soft">Paste into an HTML block on your website. {link.auto_create_invoice ? "Opening the graphic automatically requests an invoice." : "The graphic links to the payment review page; the customer creates an invoice from there."} No form or JavaScript is needed. You can also attach the reusable link to your own button.</p>
      <details><summary className="min-h-11 cursor-pointer font-semibold">Edit settings</summary><PaymentLinkEditor currencies={currencies} link={link} /></details>
    </article>)}
  </section>;
}
