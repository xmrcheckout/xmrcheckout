import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DonationForm from "../../../components/donation-form";
import PageIntroBand from "../../../components/page-intro-band";
import { areDonationsEnabled } from "../../../lib/donations";
import { getI18n } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("donate.metaTitle"), description: t("donate.metaDescription") };
}

export default async function DonatePage() {
  if (!areDonationsEnabled()) {
    notFound();
  }
  const { t } = await getI18n();

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl px-[6vw] pb-20 pt-10 text-ink">
      <PageIntroBand
        description={t("donate.introDescription")}
        eyebrow={t("donate.introEyebrow")}
        id="donate-title"
        title={t("donate.introTitle")}
      />

      <section className="mt-6 max-w-3xl">
        <div className="rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-7">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-clay" aria-hidden="true" />
            {t("donate.amountHeading")}
          </p>
          <h2 className="mt-2 font-sans text-2xl font-semibold">
            {t("donate.formTitle")}
          </h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            {t("donate.formDescription")}
          </p>
          <div className="mt-6">
            <DonationForm />
          </div>
        </div>
      </section>
    </main>
  );
}
