"use client";

import Image from "next/image";
import Link from "next/link";

import PageError from "../components/page-error";

// Catches /i/ pages and group layout failures. Importing marketing.css here
// could restyle checkout pages, and signed-in state is unknown, so this stays
// Tailwind-only and shows no navigation.
export default function RootError() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="mx-auto w-full max-w-6xl px-[6vw] pt-6">
        <Link className="inline-flex min-h-11 items-center gap-3 font-sans font-semibold" href="/">
          <Image className="h-10 w-10" src="/logo.png" alt="" width={128} height={128} priority />
          XMR Checkout
        </Link>
      </header>
      <PageError />
    </div>
  );
}
