"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto min-h-[60vh] max-w-2xl px-6 py-16 text-ink">
    <h1 className="font-sans text-3xl font-semibold">Page unavailable</h1>
    <p className="mt-4">We could not load this page. Try again. If you were creating an invoice, check your invoice list before submitting again.</p>
    <div className="mt-6 flex flex-wrap gap-4">
      <button className="min-h-11 rounded-full bg-ink px-6 py-3 text-cream" onClick={reset}>Try again</button>
      <Link className="inline-flex min-h-11 items-center underline" href="/">Return home</Link>
    </div>
  </main>;
}
