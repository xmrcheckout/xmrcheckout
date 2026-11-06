import Link from "next/link";

import { getI18n } from "../../../../lib/i18n/server";

export default async function PaymentLinkNotFound() {
  const { t } = await getI18n();
  return <main id="main-content" tabIndex={-1} className="mx-auto min-h-[60vh] max-w-2xl px-6 py-16 text-ink">
    <h1 className="font-sans text-3xl font-semibold">{t("paymentLink.unavailableTitle")}</h1>
    <p className="mt-4">{t("paymentLink.unavailableHelp")}</p>
    <Link className="mt-6 inline-flex min-h-11 items-center underline" href="/">{t("common.returnHome")}</Link>
  </main>;
}
