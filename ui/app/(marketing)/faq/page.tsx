import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about XMR Checkout: non-custodial Monero invoices with view-only detection.",
};

const donationsEnabled = process.env.NEXT_PUBLIC_DONATIONS_ENABLED === "true";

type FaqItem = {
  question: string;
  answer: React.ReactNode;
};

function ComparisonYesNo({
  value,
  label,
}: {
  value: boolean;
  label: string;
}) {
  return (
    <span className="inline-flex items-center justify-center">
      <span
        className={[
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
          value ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink-soft",
        ].join(" ")}
        aria-label={label}
        title={label}
      >
        {value ? "✓" : "✕"}
      </span>
    </span>
  );
}

const faqItems: FaqItem[] = [
	  {
	    question: "Is XMR Checkout custodial?",
	    answer: (
	      <>
	        <p className="text-ink-soft">
	          No. Payments go directly from the customer to your Monero wallet. XMR
	          Checkout only observes the blockchain to detect payments and update
	          invoice status.
	        </p>
	      </>
	    ),
	  },
  {
    question: "What wallet access does XMR Checkout require?",
    answer: (
      <>
        <p className="text-ink-soft">
          The maximum permission we ask for is view-only access: your primary
          address and your secret view key. We never request spend keys and we
          never request signing access.
        </p>
      </>
    ),
  },
		  {
		    question: "What does setup require?",
		    answer: (
		      <>
		        <p className="text-ink-soft">
		          Setup is explicit: provide your primary address and secret
		          view key, then create invoices via the dashboard or API. We never
		          request spend keys or signing access.
		        </p>
		      </>
		    ),
		  },
  {
    question: "Do you require email or personal information?",
    answer: (
      <>
        <p className="text-ink-soft">
          No. We do not require email or personal information. Your primary
          address is the identifier for access, paired with your secret view key.
        </p>
      </>
    ),
  },
	  {
	    question: "What does XMR Checkout cost?",
	    answer: (
	      <>
	        <p className="text-ink-soft">
	          Currently, xmrcheckout.com does not charge a service fee. You can also self-host the open source
	          stack if you prefer.
	        </p>
	        {donationsEnabled ? (
	          <p className="text-ink-soft">
	            If you find XMR Checkout useful, you can support development with{" "}
	            <Link className="underline underline-offset-4" href="/donate">
	              donations
	            </Link>
	            .
	          </p>
	        ) : null}
	      </>
	    ),
	  },
  {
    question: "Can XMR Checkout move funds, issue refunds, or reverse payments?",
    answer: (
      <>
        <p className="text-ink-soft">
          No. XMR Checkout does not sign transactions and cannot move funds on
          your behalf. It is checkout software: create invoices, detect
          payments, and relay status via API/webhooks.
        </p>
      </>
    ),
  },
  {
    question: "What happens if XMR Checkout is down when a customer pays?",
    answer: (
      <>
        <p className="text-ink-soft">
          Your wallet can still receive a valid on-chain payment because the
          payment is customer → merchant wallet. If the service is unavailable,
          you may temporarily lose invoice status updates until it comes back
          online.
        </p>
      </>
    ),
  },
	  {
	    question: "How does XMR Checkout differ from hosted services (e.g. NOWPayments)?",
	    answer: (
	      <>
	        <p className="text-ink-soft">
	          The main differences are scope, custody model, and data collection: XMR Checkout is Monero-only,
	          does not require an account or email, and uses view-only access for payment detection.
	        </p>
	        <ul className="mt-4 grid gap-2 text-sm text-ink-soft">
	          <li>
	            <span className="font-semibold text-ink">Monero-only:</span> a focused
	            product without a multi-asset stack.
	          </li>
	          <li>
	            <span className="font-semibold text-ink">No account/email:</span> your primary address is the identifier.
	          </li>
	          <li>
	            <span className="font-semibold text-ink">No custody:</span> payments
	            go directly to your wallet.
	          </li>
          <li>
            <span className="font-semibold text-ink">View-only by design:</span>{" "}
            we never ask for spend keys.
          </li>
          <li>
            <span className="font-semibold text-ink">Clear failure modes:</span>{" "}
            downtime can delay status updates, but it does not affect on-chain
            validity of payments.
          </li>
	        </ul>
	        <p className="mt-4 text-ink-soft">
	          If you use a third-party service, review what keys and data it requires, and whether it ever takes custody
	          or intermediates funds.
	        </p>
	      </>
	    ),
	  },
	  {
	    question: "How does XMR Checkout differ from BTCPay Server?",
	    answer: (
	      <>
	        <p className="text-ink-soft">
	          BTCPay Server is a general-purpose, self-hosted payment server with a primary focus on Bitcoin
	          and optional integrations for other assets (including Monero via a plugin). XMR Checkout is intentionally
	          focused on Monero checkout with a view-only trust boundary and a minimal, deterministic core.
	        </p>
	        <p className="text-ink-soft">
	          Some hosted BTCPay deployments may not include the Monero plugin by default. XMR Checkout provides a
	          small compatibility layer so teams can integrate without running a full BTCPay deployment.
	        </p>
        <ul className="mt-4 grid gap-2 text-sm text-ink-soft">
          <li>
            <span className="font-semibold text-ink">Monero-first UX:</span>{" "}
            invoice and confirmation language is tailored to Monero.
          </li>
          <li>
            <span className="font-semibold text-ink">Fewer moving parts:</span>{" "}
            a narrow scope keeps operations and audits simpler.
          </li>
          <li>
            <span className="font-semibold text-ink">API/webhooks-first:</span>{" "}
            designed to fit into existing order systems.
          </li>
        </ul>
      </>
    ),
  },
  {
    question: "Can I self-host XMR Checkout?",
    answer: (
      <>
        <p className="text-ink-soft">
          Yes. XMR Checkout is open source, and you can self-host it from the
          official{" "}
          <Link
            className="underline underline-offset-4"
            href="https://github.com/xmrcheckout/xmrcheckout"
          >
            GitHub repository
          </Link>
          .
        </p>
        <p className="text-ink-soft">
          Start with{" "}
          <Link className="underline underline-offset-4" href="/docs">
            Documentation
          </Link>{" "}
          for setup and integration details.
        </p>
      </>
    ),
  },
];

function FaqCard({ item }: { item: FaqItem }) {
  return (
    <details className="group rounded-2xl border border-stroke bg-white/70 p-6 shadow-soft backdrop-blur">
      <summary className="cursor-pointer list-none select-none font-serif text-xl text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-start justify-between gap-4">
          <span>{item.question}</span>
          <span className="mt-1 text-sm text-ink-soft transition group-open:rotate-45">
            +
          </span>
        </span>
      </summary>
      <div className="mt-4 grid gap-3 text-sm leading-relaxed">{item.answer}</div>
    </details>
  );
}

export default function FaqPage() {
  return (
    <main className="text-ink">
      <section className="px-[6vw] pb-20 pt-10">
        <div className="grid gap-4">
	          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-monero">
	            FAQ
	          </p>
	          <h1 className="font-serif text-3xl">Direct answers.</h1>
	          <p className="max-w-[46rem] text-[1.02rem] leading-relaxed text-ink-soft">
	            XMR Checkout is non-custodial checkout software for accepting Monero
	            payments. We focus on a conservative trust boundary: view-only
	            detection and merchant-owned funds.
	          </p>
        </div>

        <div className="mt-10 grid gap-4">
          {faqItems.map((item) => (
            <FaqCard key={item.question} item={item} />
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-stroke bg-card p-8 shadow-card backdrop-blur">
          <h2 className="font-serif text-2xl">Still have questions?</h2>
          <p className="mt-2 text-ink-soft">
            Start with{" "}
            <Link className="underline underline-offset-4" href="/docs">
              Documentation
            </Link>{" "}
            for API details and integration guidance.
          </p>
        </div>
      </section>
    </main>
  );
}
