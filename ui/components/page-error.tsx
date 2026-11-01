"use client";

import Link from "next/link";

import PageIntroBand from "./page-intro-band";

export default function PageError() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
      <PageIntroBand
        eyebrow="Error"
        id="page-unavailable"
        title="Page unavailable"
        description="We could not load this page. Try again. If you were creating an invoice, check your invoice list before submitting again."
      />
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button className="min-h-11 rounded-full bg-ink px-5 py-2.5 text-cream" onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link className="inline-flex min-h-11 items-center underline" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
