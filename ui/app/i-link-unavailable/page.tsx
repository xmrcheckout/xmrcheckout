import MarketingShell from "../../components/marketing-shell";
import MissingBuyerLink from "../../components/missing-buyer-link";
import BtcpayModalBridge from "../../components/btcpay-modal-bridge";
import { getI18n } from "../../lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("invoicePage.linkUnavailableTitle"), robots: { index: false, follow: false } };
}

export default async function UnavailableCompactLink({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  return <MarketingShell variant="compact">
    {query.invoice ? <BtcpayModalBridge invoiceId={query.invoice} status="invalid" /> : null}
    <MissingBuyerLink kind={query.receipt === "1" ? "receipt" : "compact"} invalid={query.invalid === "1"} />
  </MarketingShell>;
}
