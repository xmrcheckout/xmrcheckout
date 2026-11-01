import type { Metadata } from "next";
import Link from "next/link";

import MarketingShell from "../components/marketing-shell";
import PageIntroBand from "../components/page-intro-band";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <MarketingShell>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
        <PageIntroBand
          eyebrow="Error 404"
          id="page-not-found"
          title="Page not found"
          description="Check the link or return to the homepage."
        />
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink px-5 py-2.5 text-cream" href="/">
          Return home
        </Link>
      </main>
    </MarketingShell>
  );
}
