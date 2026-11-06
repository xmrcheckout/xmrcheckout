import type { Metadata } from "next";
import MarketingShell from "../../components/marketing-shell";

// Pages the merchant's customers use to pay: branded, without site navigation.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShell variant="checkout">{children}</MarketingShell>;
}
