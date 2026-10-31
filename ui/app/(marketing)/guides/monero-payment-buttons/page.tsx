import type { Metadata } from "next";
import Link from "next/link";
import PageIntroBand from "../../../../components/page-intro-band";
import CopyCodeBlock from "../../../../components/copy-code-block";
import { paymentButtonHtml } from "../../../../lib/payment-button";

const title = "Accept Monero with payment and donation links";
const description = "Accept payments or fixed-amount donations directly to your wallet. Share a reusable Monero link or embed an HTML button without programming.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/guides/monero-payment-buttons" },
  openGraph: { type: "article", url: "/guides/monero-payment-buttons", siteName: "XMR Checkout", title, description },
  twitter: { card: "summary", title, description },
};
const sectionClass = "min-w-0 scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-8";
const codeClass = "mt-4 max-w-full overflow-x-auto rounded-xl bg-ink px-5 pb-5 pt-16 font-mono text-sm text-cream";
const linkClass = "font-semibold underline decoration-clay underline-offset-4";
const sections = [["setup", "Configure your product"], ["embed", "Copy your button or link"], ["invoices", "Review purchases"], ["manage", "Change or disable a link"], ["donations", "Accept donations"], ["limits", "Capacity and failures"]];

export default function PaymentButtonsGuide() {
  return <main className="reference-page px-[6vw] pb-20 pt-8 text-ink"><div className="mx-auto w-full max-w-5xl">
    <PageIntroBand eyebrow="Guide · Payment links" id="payment-buttons-title" title={title} description={<p>Accept Monero on an independent website without WooCommerce or an API integration. Use payment links for products, services, or fixed-amount donations to your own wallet. Configure the amount in the dashboard, then paste a button into an HTML block or share a reusable link.</p>} />
    <nav aria-label="Payment button guide sections" className="mt-6 grid gap-2 rounded-surface border border-stroke bg-card p-3 sm:grid-cols-2">
      {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 font-semibold hover:bg-white/70">{label}</a>)}
    </nav>
    <div className="mt-8 grid gap-6">
      <section id="setup" aria-labelledby="setup-title" className={sectionClass}>
        <h2 id="setup-title" className="font-sans text-2xl font-semibold">Configure a fixed-amount link</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5">
          <li>Connect your wallet using your primary address and private view key. Never submit a private spend key or recovery seed. Customer payments go directly to your wallet.</li>
          <li>Open <Link href="/dashboard?tab=payment-links" className={linkClass}>Dashboard → Payment links</Link>, then choose <strong>Create payment link</strong>.</li>
          <li>Enter a title and optional description. For example, use “Digital guide” with a fixed amount of 20 and currency EUR. You can also choose an exact XMR amount. Customer-entered amounts are not supported.</li>
          <li>Choose your required confirmations. The form starts with your merchant default; zero accepts detection without waiting for a block confirmation. Optionally add an HTTPS merchant return URL.</li>
          <li>Leave <strong>Enable new purchases</strong> selected and save. Set Button text to customize the graphic label (up to 32 characters). The default is “Buy with Monero”. Copy controls appear in the payment-link list; copy the updated HTML after changing the label. Optionally enable “Skip review and create invoice automatically” to open invoices directly. This is off by default; visits, including automated browsers, can consume invoice allowance and address capacity.</li>
        </ol>
        <p className="mt-4">For the €20 reference, each purchase request calculates an XMR amount using the available informational quote. The invoice is defined in XMR and displays the quote source and timestamp. There is no rate lock or guaranteed EUR outcome. If the quote is unavailable, creation fails.</p>
        <p className="mt-3 text-sm text-ink-soft">Need your own deployment first? Follow the <Link href="/guides/self-hosted-monero-checkout" className={linkClass}>self-hosting guide</Link>. A working view-only wallet and synchronized detection services are prerequisites.</p>
      </section>
      <section id="embed" aria-labelledby="embed-title" className={sectionClass}>
        <h2 id="embed-title" className="font-sans text-2xl font-semibold">Copy your HTML button or reusable URL</h2>
        <p className="mt-4">Preview the branded button in the dashboard, then copy its HTML into a custom HTML block on your website. The graphic includes the xmrcheckout logo and links to the payment review page. No form, JavaScript, or merchant API key is needed in the snippet.</p>
        <CopyCodeBlock className={codeClass}>{paymentButtonHtml("https://checkout.example/pay/YOUR_PUBLIC_TOKEN")}</CopyCodeBlock>
        <p className="mt-3 text-sm text-ink-soft">This example uses a reserved example domain and placeholder token. Copy your actual snippet from the dashboard; keep your wallet credentials and API key out of website HTML.</p>
        <p className="mt-4">You can also copy the reusable URL and attach it to a normal link or your own website button. Both options show the product review page; the customer then submits a purchase request. With review enabled, opening a URL does not create an invoice. With automatic creation enabled, an active browser requests an invoice and opens it. The same tab resumes its current unpaid invoice; use “Start another purchase” for a separate order. Without JavaScript or browser storage, customers use the manual creation button.</p>
        <p className="mt-3">Purchases use the saved receiving wallet, amount, confirmation target, and return URL. Editing HTML cannot override these settings.</p>
      </section>
      <section id="invoices" aria-labelledby="invoices-title" className={sectionClass}>
        <h2 id="invoices-title" className="font-sans text-2xl font-semibold">Review each purchase in your invoice list</h2>
        <p className="mt-4">A successful submission opens an invoice with its own ID, XMR amount, payment instructions, and confirmation progress. Keep the invoice URL and use its ID when discussing a purchase with the customer.</p>
        <p className="mt-3">Review payment-link invoices in Dashboard → Invoices. Search the product title or payment-link ID in invoice metadata. Each invoice retains a snapshot of the product settings; optional existing webhooks also include that metadata.</p>
        <p className="mt-3">Payment detection and reaching your confirmation target are separate states. Review the invoice status before fulfilling an order. Payment links do not collect buyer details or provide protected downloads. Arrange delivery yourself using the invoice ID; a merchant return URL is navigation after confirmation and does not protect a file.</p>
      </section>
      <section id="manage" aria-labelledby="manage-title" className={sectionClass}>
        <h2 id="manage-title" className="font-sans text-2xl font-semibold">Edit or disable future purchases</h2>
        <p className="mt-4">Open <strong>Edit settings</strong> on the link to change its product details or amount. Saved changes apply to future invoices, while existing invoices keep their original settings. The reusable URL and button continue to identify the same link.</p>
        <p className="mt-3">Use <strong>Disable payment link</strong> to stop new purchases. Existing invoices remain valid and continue detection. Re-enable a link through its settings after correcting any unsupported saved currency or other invalid settings.</p>
      </section>
      <section id="donations" aria-labelledby="donations-title" className={sectionClass}>
        <h2 id="donations-title" className="font-sans text-2xl font-semibold">Accept fixed-amount Monero donations</h2>
        <p className="mt-4">Creators, maintainers, and other recipients can use payment links to receive voluntary contributions directly to their own wallet. Each successful submission creates a separate invoice with payment detection and confirmation progress.</p>
        <ol className="mt-4 list-decimal space-y-3 pl-5">
          <li>Create a payment link with a title such as “Support my project” and choose a fixed XMR amount. Set <strong>Button text</strong> to <strong>Donate with Monero</strong>.</li>
          <li>Share the reusable URL on your profile or website, or copy the HTML button from the dashboard. You can attach the URL to your own “Support this project” button too.</li>
          <li>To offer several preset amounts, create a separate link for each amount. Donors cannot enter their own amount on these links.</li>
          <li>Keep the review step enabled if opening a shared URL should not create an invoice. Automatic creation is optional and consumes capacity when an active browser requests an invoice.</li>
        </ol>
        <p className="mt-4">Each contribution is a separate payment initiated in the donor’s wallet. These links do not provide recurring collection or donor management. A supported fiat-reference amount is converted to an informational XMR amount at invoice creation; no rate or fiat outcome is guaranteed.</p>
        <CopyCodeBlock className={codeClass}>{paymentButtonHtml("https://checkout.example/pay/YOUR_DONATION_LINK_TOKEN", "Donate with Monero")}</CopyCodeBlock>
        <p className="mt-3 text-sm text-ink-soft">Example only: use the actual HTML or URL from your dashboard. Your credentials do not belong in the snippet. Donation links share the same <a className={linkClass} href="#limits">invoice allowance, address capacity, and interrupted-submission limits</a> as other payment links. Unpaid invoices consume capacity too.</p>
      </section>
      <section id="limits" aria-labelledby="limits-title" className={sectionClass}>
        <h2 id="limits-title" className="font-sans text-2xl font-semibold">Understand capacity and uncertain responses</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5">
          <li>The default public allowance is 10 successful invoice creations per merchant over a rolling 24 hours, shared across all payment links. The dashboard shows this deployment’s configured limit, usage, remaining allowance, and address availability. Refresh retrieves both snapshots; neither reserves capacity.</li>
          <li>Other merchant invoice limits still apply. The address pool supports up to 100 invoice subaddresses per merchant. Unpaid requests consume capacity too. An address can be reused after its prior invoices close and the default seven-day cooldown passes. A fresh invoice does not guarantee a never-used address; a new late payment intended for an older invoice can still be confused with a newer one after reuse.</li>
          <li>The default Nginx configuration also limits public purchase requests to 6 per minute per client IP, with burst 3. Operators can configure these limits and the reuse cooldown. Rate or capacity errors may include Retry-After guidance.</li>
          <li>Plain HTML has no duplicate-submission recovery. Separate submissions can create separate invoices. If a response is interrupted, creation may already have succeeded. Do not automatically retry: check any invoice URL received or contact the merchant before submitting again.</li>
        </ul>
        <p className="mt-4">A service outage can make checkout or status detection unavailable; payments already sent remain valid on-chain and you retain access to your wallet. A malicious visitor can consume your public allowance, so monitor usage and disable links when needed.</p>
        <p className="mt-4">Developers can find the management endpoints and public form behavior in the <Link href="/docs#payment-links" className={linkClass}>payment-link API reference</Link>.</p>
      </section>
    </div>
  </div></main>;
}
