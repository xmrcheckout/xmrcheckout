"use client";

import Link from "next/link";

export default function InvoiceStatusActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:opacity-95"
        href="/invoice"
      >
        Check another invoice
      </Link>
    </div>
  );
}
