import InvoiceNotFound from "../invoice/[invoiceId]/not-found";
import { getI18n } from "../../../lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("invoicePage.linkUnavailableTitle"), robots: { index: false, follow: false } };
}

export default InvoiceNotFound;
