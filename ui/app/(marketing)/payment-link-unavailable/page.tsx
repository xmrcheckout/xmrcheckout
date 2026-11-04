import PaymentLinkNotFound from "../pay/[token]/not-found";
import { getI18n } from "../../../lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("paymentLink.unavailableTitle"), robots: { index: false, follow: false } };
}

export default PaymentLinkNotFound;
