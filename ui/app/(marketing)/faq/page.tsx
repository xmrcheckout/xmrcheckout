import type { Metadata } from "next";
import Link from "next/link";

import PageIntroBand from "../../../components/page-intro-band";
import { areDonationsEnabled } from "../../../lib/donations";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about XMR Checkout: non-custodial Monero invoices with view-only detection.",
};

const donationsEnabled = areDonationsEnabled();

type FaqItem = {
  question: string;
  answer: React.ReactNode;
  category: FaqCategory;
};

type FaqCategory = "custody" | "operations" | "comparisons";

const faqGroups: Array<{
  id: FaqCategory;
  label: string;
  description: string;
  accentClass: string;
}> = [
  {
    id: "custody",
    label: "Custody & access",
    description: "Wallet permissions, sign-in data, and merchant control.",
    accentClass: "bg-clay",
  },
  {
    id: "operations",
    label: "Operations & availability",
    description: "Service cost, uptime, and safe failure behavior.",
    accentClass: "bg-sage",
  },
  {
    id: "comparisons",
    label: "Comparisons & self-hosting",
    description: "Deployment choices and differences from adjacent tools.",
    accentClass: "bg-ink",
  },
];

function ComparisonYesNo({ value, label }: { value: boolean; label: string }) {
  return (
    <span className="inline-flex items-center justify-center">
      <span
        className={[
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
          value ? "bg-sage/20 text-ink" : "bg-ink/10 text-ink-soft",
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
    category: "custody",
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
    category: "custody",
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
    category: "custody",
    answer: (
      <>
        <p className="text-ink-soft">
          Setup is explicit: provide your primary address and secret view key,
          then create invoices via the dashboard or API. We never request spend
          keys or signing access.
        </p>
      </>
    ),
  },
  {
    question: "Do you require email or personal information?",
    category: "custody",
    answer: (
      <>
        <p className="text-ink-soft">
          No. We do not require email or personal information. Your primary
          address is the identifier for access, paired with your secret view
          key.
        </p>
      </>
    ),
  },
  {
    question: "What does XMR Checkout cost?",
    category: "operations",
    answer: (
      <>
        <p className="text-ink-soft">
          Currently, xmrcheckout.com does not charge a service fee. You can also
          self-host the open source stack if you prefer.
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
    question:
      "Can XMR Checkout move funds, issue refunds, or reverse payments?",
    category: "custody",
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
    category: "operations",
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
    question:
      "How does XMR Checkout differ from hosted services (e.g. NOWPayments)?",
    category: "comparisons",
    answer: (
      <>
        <p className="text-ink-soft">
          The main differences are scope, custody model, and data collection:
          XMR Checkout is Monero-only, does not require an account or email, and
          uses view-only access for payment detection.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-ink-soft">
          <li>
            <span className="font-semibold text-ink">Monero-only:</span> a
            focused product without a multi-asset stack.
          </li>
          <li>
            <span className="font-semibold text-ink">No account/email:</span>{" "}
            your primary address is the identifier.
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
          If you use a third-party service, review what keys and data it
          requires, and whether it ever takes custody or intermediates funds.
        </p>
      </>
    ),
  },
  {
    question: "How does XMR Checkout differ from BTCPay Server?",
    category: "comparisons",
    answer: (
      <>
        <p className="text-ink-soft">
          BTCPay Server is a general-purpose, self-hosted payment server with a
          primary focus on Bitcoin and optional integrations for other assets
          (including Monero via a plugin). XMR Checkout is intentionally focused
          on Monero checkout, view-only detection, and a minimal, deterministic
          core.
        </p>
        <p className="text-ink-soft">
          Some hosted BTCPay deployments may not include the Monero plugin by
          default. XMR Checkout provides a small compatibility layer so teams
          can integrate without running a full BTCPay deployment.
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
    category: "comparisons",
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
    <details className="group border-t border-stroke px-5 py-5 first:border-t-0 sm:px-6">
      <summary className="cursor-pointer list-none select-none font-sans font-semibold text-lg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden sm:text-xl">
        <span className="flex items-start justify-between gap-4">
          <span>{item.question}</span>
          <span
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stroke bg-cream text-sm text-ink-soft transition group-open:rotate-45"
            aria-hidden="true"
          >
            +
          </span>
        </span>
      </summary>
      <div className="mt-4 grid gap-3 text-sm leading-relaxed">
        {item.answer}
      </div>
    </details>
  );
}

export default function FaqPage() {
  return (
    <main className="px-[6vw] pb-20 pt-8 text-ink">
      <section
        className="mx-auto w-full max-w-7xl"
        aria-label="FAQ introduction"
      >
        <PageIntroBand
          eyebrow="FAQ"
          id="faq-title"
          title="Direct answers about control, access, and operations."
          description={
            <p>
              XMR Checkout is non-custodial checkout software for accepting
              Monero payments. Detection is view-only, and customer payments go
              to the merchant wallet.
            </p>
          }
          facts={[
            { label: "Custody", value: "Merchant wallet" },
            { label: "Access", value: "View-only" },
            { label: "Spend keys", value: "Never requested" },
          ]}
        />
      </section>

      <div className="mx-auto mt-6 grid w-full max-w-7xl gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <nav
          className="min-w-0 lg:sticky lg:top-24 lg:self-start"
          aria-label="FAQ categories"
        >
          <div className="overflow-hidden rounded-surface border border-stroke bg-card shadow-soft">
            <div className="border-b border-stroke px-5 py-4">
              <p className="font-sans text-base font-semibold">
                Browse by topic
              </p>
              <p className="mt-1 hidden text-sm text-ink-soft lg:block">
                Control, operations, and deployment.
              </p>
            </div>
            <div className="grid gap-1.5 p-3">
              {faqGroups.map((group, index) => (
                <a
                  className="inline-flex min-h-10 shrink-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-stroke hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href={`#${group.id}`}
                  key={group.id}
                >
                  <span className="font-mono text-xs text-ink-soft/70">
                    0{index + 1}
                  </span>
                  {group.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        <div className="min-w-0 space-y-8">
          {faqGroups.map((group, index) => {
            const items = faqItems.filter((item) => item.category === group.id);

            return (
              <section
                className="scroll-mt-24"
                id={group.id}
                key={group.id}
                aria-labelledby={`${group.id}-title`}
              >
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stroke pb-4">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${group.accentClass}`}
                        aria-hidden="true"
                      />
                      Topic 0{index + 1}
                    </p>
                    <h2
                      className="mt-1 font-sans text-2xl font-semibold"
                      id={`${group.id}-title`}
                    >
                      {group.label}
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {group.description}
                    </p>
                  </div>
                  <span className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-xs font-semibold text-ink-soft">
                    {items.length} answers
                  </span>
                </header>
                <div className="mt-4 overflow-hidden rounded-surface border border-stroke bg-white/70 shadow-soft">
                  {items.map((item) => (
                    <FaqCard key={item.question} item={item} />
                  ))}
                </div>
              </section>
            );
          })}

          <aside className="overflow-hidden rounded-surface border border-ink bg-ink px-6 py-6 text-cream shadow-card sm:px-8">
            <p className="text-sm font-semibold text-cream/60">More detail</p>
            <h2 className="mt-1 font-sans text-2xl font-semibold">
              Still have questions?
            </h2>
            <p className="mt-2 text-cream/70">
              Start with{" "}
              <Link
                className="font-semibold text-cream underline decoration-clay underline-offset-4"
                href="/docs"
              >
                Documentation
              </Link>{" "}
              for API details and integration guidance.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
