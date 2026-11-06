import type { Metadata } from "next";
import MarketingShell from "../../components/marketing-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CompactCheckoutLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell variant="compact">{children}</MarketingShell>;
}
