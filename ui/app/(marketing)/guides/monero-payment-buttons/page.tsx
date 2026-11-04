import type { Metadata } from "next";
import Link from "next/link";
import PageIntroBand from "../../../../components/page-intro-band";
import CopyCodeBlock from "../../../../components/copy-code-block";
import { badgeHtml, paymentButtonHtml } from "../../../../lib/payment-button";

const title = "Accept Monero with payment and donation links";
const description = "Accept payments or donations directly to your wallet. Share a reusable Monero link or embed an HTML button without programming.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/guides/monero-payment-buttons" },
  openGraph: { type: "article", url: "/guides/monero-payment-buttons", siteName: "XMR Checkout", title, description },
  twitter: { card: "summary", title, description },
};
const sectionClass = "min-w-0 scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-8";
const codeClass = "mt-4 max-w-full overflow-x-auto rounded-xl bg-ink px-5 pb-5 pt-16 font-mono text-sm text-cream";
const linkClass = "font-semibold underline decoration-clay underline-offset-4";
const sections = [["setup", "Configure your product"], ["embed", "Copy your button or link"], ["invoices", "Review purchases"], ["confirmation-message", "Show a message after payment"], ["manage", "Change or disable a link"], ["donations", "Accept donations"], ["let-people-find-you", "Let people find you"], ["limits", "Capacity and failures"]];

export default function PaymentButtonsGuide() {
  return <main id="main-content" tabIndex={-1} className="reference-page px-[6vw] pb-20 pt-8 text-ink"><div className="mx-auto w-full max-w-5xl">
    <PageIntroBand eyebrow="Guide · Payment links" id="payment-buttons-title" title={title} description={<p>Accept Monero on an independent website without WooCommerce or an API integration. Use payment links for products, services, or donations to your own wallet. Configure a fixed amount or let the customer enter one in the dashboard, then paste a button into an HTML block or share a reusable link.</p>} />
    <nav aria-label="Payment button guide sections" className="mt-6 grid gap-2 rounded-surface border border-stroke bg-card p-3 sm:grid-cols-2">
      {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 font-semibold hover:bg-white/70">{label}</a>)}
    </nav>
    <div className="mt-8 grid gap-6">
      <section id="setup" aria-labelledby="setup-title" className={sectionClass}>
        <h2 id="setup-title" className="font-sans text-2xl font-semibold">Configure a payment link</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5">
          <li>Connect your wallet using your primary address and private view key. Never submit a private spend key or recovery seed. Customer payments go directly to your wallet.</li>
          <li>Open <Link href="/dashboard?tab=payment-links" className={linkClass}>Dashboard → Payment links</Link>, then choose <strong>Create payment link</strong>.</li>
          <li>Enter a title and optional description. For example, use “Digital guide” with a fixed amount of 20 and currency EUR. You can also choose an exact XMR amount, or select <strong>Customer enters the amount</strong> to let the customer type it (see <a href="#donations" className={linkClass}>donations</a>).</li>
          <li>Choose your required confirmations. The form starts with your merchant default; zero accepts detection without waiting for a block confirmation. Optionally add an HTTPS merchant return URL and a <a href="#confirmation-message" className={linkClass}>confirmation message</a> shown after payment.</li>
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
        <p className="mt-3">Payment detection and reaching your confirmation target are separate states. Review the invoice status before fulfilling an order. Payment links do not collect buyer details or host files. Use a <a href="#confirmation-message" className={linkClass}>confirmation message</a> to show a download link or instructions after confirmation, or arrange delivery yourself using the invoice ID. A merchant return URL is navigation after confirmation.</p>
      </section>
      <section id="confirmation-message" aria-labelledby="confirmation-message-title" className={sectionClass}>
        <h2 id="confirmation-message-title" className="font-sans text-2xl font-semibold">Show a confirmation message after payment</h2>
        <p className="mt-4">Each payment link can have its own <strong>Confirmation message</strong>. It appears on the buyer’s invoice page under “Message from the merchant” once the invoice reaches your required confirmations. Until then, the message is not sent to the browser: the page is rendered on the server and the public invoice status returns no message. Web addresses starting with http:// or https:// become clickable links.</p>
        <h3 className="mt-6 font-sans text-lg font-semibold">Example uses</h3>
        <ul className="mt-3 list-disc space-y-3 pl-5">
          <li><strong>Digital downloads.</strong> Selling five ebooks? Create five payment links, one per ebook, and put each ebook’s download link in that link’s message, for example “Thanks! Download your copy: https://your-site.example/files/ebook-1.pdf”.</li>
          <li><strong>Shared access details.</strong> A license key, course access code, or private group invitation that is the same for every buyer.</li>
          <li><strong>Delivery instructions.</strong> Next steps such as “Email your invoice ID to orders@your-site.example with your postal address” or “Book your session at https://your-site.example/book”.</li>
          <li><strong>Thank-you notes.</strong> A short note with links to support pages, documentation, or updates.</li>
        </ul>
        <h3 className="mt-6 font-sans text-lg font-semibold">Limits and good practice</h3>
        <ul className="mt-3 list-disc space-y-3 pl-5">
          <li>Every buyer of a link sees the same text, and a buyer can share it with others. For files you need to protect, host them where you control access, such as expiring or signed download links, or a store that checks the invoice ID. Use <Link href="/guides/monero-payment-api-webhooks#webhooks" className={linkClass}>webhooks</Link> to issue unique keys or downloads per buyer.</li>
          <li>The message follows your confirmation target. With zero confirmations it appears as soon as a payment is detected, before any block confirmation; choose at least one confirmation for content you cannot take back.</li>
          <li>Each invoice keeps the message that was saved when it was created. Editing a link changes the message for new invoices only.</li>
          <li>Messages are plain text up to 2,000 characters. Formatting and HTML are shown as typed. Files are not uploaded or hosted by XMR Checkout.</li>
          <li>The message is merchant-provided information. XMR Checkout displays it but does not check its content or guarantee what it links to.</li>
        </ul>
      </section>
      <section id="manage" aria-labelledby="manage-title" className={sectionClass}>
        <h2 id="manage-title" className="font-sans text-2xl font-semibold">Edit or disable future purchases</h2>
        <p className="mt-4">Open <strong>Edit settings</strong> on the link to change its product details or amount. Saved changes apply to future invoices, while existing invoices keep their original settings. The reusable URL and button continue to identify the same link.</p>
        <p className="mt-3">Use <strong>Disable payment link</strong> to stop new purchases. Existing invoices remain valid and continue detection. Re-enable a link through its settings after correcting any unsupported saved currency or other invalid settings.</p>
      </section>
      <section id="donations" aria-labelledby="donations-title" className={sectionClass}>
        <h2 id="donations-title" className="font-sans text-2xl font-semibold">Accept Monero donations</h2>
        <p className="mt-4">Creators, maintainers, and other recipients can use payment links to receive voluntary contributions directly to their own wallet. Each successful submission creates a separate invoice with payment detection and confirmation progress.</p>
        <ol className="mt-4 list-decimal space-y-3 pl-5">
          <li>Create a payment link with a title such as “Support my project” and choose <strong>Customer enters the amount</strong>. Set <strong>Button text</strong> to <strong>Donate with Monero</strong>. Optionally set a minimum amount in XMR to avoid very small invoices.</li>
          <li>Share the reusable URL on your profile or website, or copy the HTML button from the dashboard. You can attach the URL to your own “Support this project” button too.</li>
          <li>Donors enter an amount and choose XMR or a supported fiat-reference currency on the review page, then create their invoice. To offer preset amounts instead, create a separate fixed-amount link for each.</li>
          <li>Customer-entered links always show the review page. For fixed-amount links, keep the review step enabled if opening a shared URL should not create an invoice. Automatic creation is optional and consumes capacity when an active browser requests an invoice.</li>
        </ol>
        <p className="mt-4">Each contribution is a separate payment initiated in the donor’s wallet. These links do not provide recurring collection or donor management. A supported fiat-reference amount is converted to an informational XMR amount at invoice creation; no rate or fiat outcome is guaranteed.</p>
        <CopyCodeBlock className={codeClass}>{paymentButtonHtml("https://checkout.example/pay/YOUR_DONATION_LINK_TOKEN", "Donate with Monero")}</CopyCodeBlock>
        <p className="mt-3 text-sm text-ink-soft">Example only: use the actual HTML or URL from your dashboard. Your credentials do not belong in the snippet. Donation links share the same <a className={linkClass} href="#limits">invoice allowance, address capacity, and interrupted-submission limits</a> as other payment links. Unpaid invoices consume capacity too.</p>
      </section>
      <section id="let-people-find-you" aria-labelledby="let-people-find-you-title" className={sectionClass}>
        <h2 id="let-people-find-you-title" className="font-sans text-2xl font-semibold">Let people find you</h2>
        <p className="mt-4">People who hold Monero look for places that accept it. A few small steps make your business easier to find.</p>
        <ol className="mt-4 list-decimal space-y-3 pl-5">
          <li><strong>Add a badge to your website.</strong> Open <strong>Dashboard → Payment links</strong> and copy the <strong>Monero accepted here</strong> badge into an HTML block. There is a dark badge for light backgrounds and a light badge for dark ones. The badge is a plain image with no tracking or account details.</li>
          <li><strong>Print a sign.</strong> Each payment link has a <strong>Printable sign with QR code</strong>. Customers scan it with their wallet to open the link. Use it at a counter, market stall, event table, or donation box. Signs show a price only for links fixed in XMR. For card-style checkout at a till, use a <Link className={linkClass} href="/guides/in-person-monero-checkout">terminal</Link> and display the badge beside it.</li>
          <li><strong>List your business in a Monero directory (optional).</strong> Public directories such as <a className={linkClass} href="https://monerica.com" target="_blank" rel="noreferrer">Monerica</a> list businesses that accept Monero. You submit the listing yourself through the directory’s own <a className={linkClass} href="https://app.monerica.com/submit" target="_blank" rel="noreferrer">submission form</a>, and its reviewers decide whether to add it. Directories usually require that your site clearly states it accepts Monero, which the badge helps with. XMR Checkout does not submit listings or share your details with any directory.</li>
        </ol>
        <p className="mt-4">A listing is public: anyone can see that your business accepts Monero, along with any contact details you include. Leave out details you do not want published.</p>
        <CopyCodeBlock className={codeClass} label="Badge HTML example">{badgeHtml("https://checkout.example")}</CopyCodeBlock>
        <p className="mt-3 text-sm text-ink-soft">Example only: copy the badge from your dashboard so it points to your checkout site.</p>
      </section>
      <section id="limits" aria-labelledby="limits-title" className={sectionClass}>
        <h2 id="limits-title" className="font-sans text-2xl font-semibold">Understand capacity and uncertain responses</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5">
          <li>The default public allowance is 10 successful invoice creations per merchant over a rolling 24 hours, shared across all payment links. The dashboard shows this deployment’s configured limit, usage, remaining allowance, and address availability. Refresh retrieves both snapshots; neither reserves capacity.</li>
          <li>Other merchant invoice limits still apply. The address pool supports up to 199 invoice subaddresses per merchant, all within the default range every Monero wallet watches. Unpaid requests consume capacity too. An address can be reused after its prior invoices close and the default three-day cooldown passes. A fresh invoice does not guarantee a never-used address; a new late payment intended for an older invoice can still be confused with a newer one after reuse.</li>
          <li>The default Nginx configuration also limits public purchase requests to 6 per minute per client IP, with burst 3. Operators can configure these limits and the reuse cooldown. Rate or capacity errors may include Retry-After guidance.</li>
          <li>Plain HTML has no duplicate-submission recovery. Separate submissions can create separate invoices. If a response is interrupted, creation may already have succeeded. Do not automatically retry: check any invoice URL received or contact the merchant before submitting again.</li>
        </ul>
        <p className="mt-4">A service outage can make checkout or status detection unavailable; payments already sent remain valid on-chain and you retain access to your wallet. A malicious visitor can consume your public allowance, so monitor usage and disable links when needed.</p>
        <p className="mt-4">Developers can find the management endpoints and public form behavior in the <Link href="/docs#payment-links" className={linkClass}>payment-link API reference</Link>.</p>
      </section>
    </div>
  </div></main>;
}
