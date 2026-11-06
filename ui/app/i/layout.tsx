import MarketingShell from "../../components/marketing-shell";

export default function CompactCheckoutLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell variant="compact">{children}</MarketingShell>;
}
