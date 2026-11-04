import type { Metadata } from "next";
import Link from "next/link";

import MarketingShell from "../components/marketing-shell";
import PageIntroBand from "../components/page-intro-band";
import { getI18n } from "../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("error.notFoundTitle"), robots: { index: false, follow: false } };
}

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <MarketingShell>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-[6vw] pb-20 pt-10 text-ink">
        <PageIntroBand
          eyebrow={t("error.notFoundEyebrow")}
          id="page-not-found"
          title={t("error.notFoundTitle")}
          description={t("error.notFoundDescription")}
        />
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink px-5 py-2.5 text-cream" href="/">
          {t("common.returnHome")}
        </Link>
      </main>
    </MarketingShell>
  );
}
