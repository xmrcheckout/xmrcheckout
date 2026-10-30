import { cookies } from "next/headers";
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
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return <section className="grid min-w-0 gap-6">
    <div><h2 className="text-2xl font-semibold">Payment links</h2>
      <p className="mt-2 text-ink-soft">Create a reusable button for a fixed amount. Each submission creates a separate XMR invoice paid directly to your wallet.</p>
      <p className="mt-2 text-sm text-ink-soft">Public invoice creation has a daily allowance and shares your address capacity. Repeated submissions can create separate invoices. No buyer details are collected; arrange fulfillment with your customer using the invoice ID. Return URLs do not protect downloads.</p>
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
      <p>HTML button</p><CopyCodeBlock className={codeClass}>{`<form method="post" action="${escape(link.action_url)}">\n  <button type="submit">Buy with Monero</button>\n</form>`}</CopyCodeBlock>
      <p className="text-sm text-ink-soft">Paste into an HTML block that permits forms. If your editor removes forms, use the reusable link. Opening the link shows a review page; submitting the button creates an invoice immediately.</p>
      <details><summary className="min-h-11 cursor-pointer font-semibold">Edit settings</summary><PaymentLinkEditor currencies={currencies} link={link} /></details>
    </article>)}
  </section>;
}
