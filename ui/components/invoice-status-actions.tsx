"use client";

import Link from "next/link";

export default function InvoiceStatusActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5"
        href="/invoice"
      >
        Check another invoice
      </Link>
    </div>
  );
}
