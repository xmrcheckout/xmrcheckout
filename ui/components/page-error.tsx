"use client";

import Link from "next/link";

import { useI18n } from "./i18n-provider";
import PageIntroBand from "./page-intro-band";

// Buyers on checkout pages get their own advice and are not sent to the homepage.
export default function PageError({ checkout = false }: { checkout?: boolean }) {
  const { t } = useI18n();
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
      <PageIntroBand
        eyebrow={t("error.eyebrow")}
        id="page-unavailable"
        title={t("error.title")}
        description={t(checkout ? "error.checkoutDescription" : "error.description")}
      />
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button className="min-h-11 rounded-full bg-ink px-5 py-2.5 text-cream" onClick={() => window.location.reload()}>
          {t("error.tryAgain")}
        </button>
        {checkout ? null : (
          <Link className="inline-flex min-h-11 items-center underline" href="/">
            {t("common.returnHome")}
          </Link>
        )}
      </div>
    </main>
  );
}
