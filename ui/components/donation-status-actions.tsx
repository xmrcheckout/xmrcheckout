"use client";

import Link from "next/link";

export default function DonationStatusActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/75 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
        href="/"
      >
        Back to home
      </Link>
    </div>
  );
}
