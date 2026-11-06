import MarketingShell from "../../components/marketing-shell";

// Pages the merchant's customers use to pay: branded, without site navigation.
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShell variant="checkout">{children}</MarketingShell>;
}
