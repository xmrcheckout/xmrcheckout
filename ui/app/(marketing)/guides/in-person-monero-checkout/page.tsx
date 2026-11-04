import type { Metadata } from "next";
import Link from "next/link";
import PageIntroBand from "../../../../components/page-intro-band";

const title = "Accept Monero in person with a terminal";
const description = "Turn a tablet or phone into a Monero till. Type the amount, show a QR code, and see the payment arrive in seconds, paid directly to your wallet.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/guides/in-person-monero-checkout" },
  openGraph: { type: "article", url: "/guides/in-person-monero-checkout", siteName: "XMR Checkout", title, description },
  twitter: { card: "summary", title, description },
};
const sectionClass = "min-w-0 scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-8";
const sections = [["setup", "Set up a terminal"], ["sale", "Take a payment"], ["confirmations", "Choose confirmations"], ["security", "Keep the link safe"], ["limits", "Address capacity"]];

export default function InPersonGuide() {
  return <main id="main-content" tabIndex={-1} className="reference-page px-[6vw] pb-20 pt-8 text-ink"><div className="mx-auto w-full max-w-5xl">
    <PageIntroBand eyebrow="Guide · Terminals" id="terminal-guide-title" title={title} description={<p>For cafés, market stalls, meetups, and shops. A terminal is a page on a tablet or phone at your till. Each sale is a normal XMR invoice paid directly to your wallet. The terminal never receives or holds funds.</p>} />
    <nav aria-label="Terminal guide sections" className="mt-6 grid gap-2 rounded-surface border border-stroke bg-card p-3 sm:grid-cols-2">
      {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 font-semibold hover:bg-white/70">{label}</a>)}
    </nav>
    <div className="mt-8 grid gap-6">
      <section id="setup" aria-labelledby="setup-title" className={sectionClass}>
        <h2 id="setup-title" className="font-sans text-2xl font-semibold">Set up a terminal</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5">
          <li>Connect your wallet with your primary address and private view key. Never enter a private spend key or recovery seed.</li>
          <li>Open <strong>Dashboard → Terminals</strong> and choose <strong>Create terminal</strong>. Give it a name such as “Front counter”, and pick a default currency.</li>
          <li>The dashboard shows the terminal link and a QR code once. Scan it with the device you will use at the till, or copy the link to it.</li>
          <li>On the device, add the page to the home screen for a full-screen till. The device remembers the terminal until you choose <strong>Forget this terminal</strong>.</li>
        </ol>
        <p className="mt-4">To let customers know they can pay with Monero, print the <strong>Monero accepted here</strong> badge from Dashboard → Payment links and place it by the till. <Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/monero-payment-buttons#let-people-find-you">More ways to let people find you</Link></p>
      </section>
      <section id="sale" aria-labelledby="sale-title" className={sectionClass}>
        <h2 id="sale-title" className="font-sans text-2xl font-semibold">Take a payment</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5">
          <li>Type the amount on the number pad, add an optional note such as “2 coffees”, and tap <strong>Charge</strong>.</li>
          <li>Turn the screen to the customer. They scan the QR code with their Monero wallet and send the payment.</li>
          <li>The screen shows <strong>Payment seen</strong> once the payment reaches the network, usually within 5–20 seconds.</li>
          <li>Tap <strong>New sale</strong> for the next customer. If the customer changes their mind before paying, tap <strong>Cancel sale</strong>.</li>
        </ol>
        <p className="mt-4">Amounts in a fiat currency are converted to XMR at a reference rate when the invoice is created. The rate is informational and no fiat outcome is guaranteed. Every sale appears in your invoice list and CSV export with the terminal name and note.</p>
      </section>
      <section id="confirmations" aria-labelledby="confirmations-title" className={sectionClass}>
        <h2 id="confirmations-title" className="font-sans text-2xl font-semibold">Choose confirmations</h2>
        <p className="mt-4">With zero confirmations, which is the default for terminals, the screen shows “Payment seen” as soon as the transaction reaches the network. It is not yet in a block. In rare cases a transaction seen this way never confirms. For small, everyday amounts that risk is usually acceptable.</p>
        <p className="mt-3">For larger amounts, set one or more confirmations. Each confirmation takes about two minutes. The screen shows progress until the target is reached.</p>
      </section>
      <section id="security" aria-labelledby="security-title" className={sectionClass}>
        <h2 id="security-title" className="font-sans text-2xl font-semibold">Keep the link safe</h2>
        <p className="mt-4">The terminal link can only create invoices to your wallet, show their status, and cancel its own unpaid sales. It cannot move funds, change settings, or open your dashboard.</p>
        <p className="mt-3">If a device is lost, open the terminal in the dashboard and choose <strong>Create new link</strong>. The old link stops working immediately. You can also disable a terminal at any time.</p>
      </section>
      <section id="limits" aria-labelledby="limits-title" className={sectionClass}>
        <h2 id="limits-title" className="font-sans text-2xl font-semibold">Address capacity</h2>
        <p className="mt-4">Every invoice uses one of your 199 invoice addresses. After an invoice closes, its address is held for three days so a late payment is never credited to a different customer. Cancelled and unpaid sales hold an address too.</p>
        <p className="mt-3">This allows about 66 sales a day on average. The terminal shows a warning when fewer than 20 addresses are free. The dashboard shows when held addresses become available again.</p>
      </section>
    </div>
  </div></main>;
}
