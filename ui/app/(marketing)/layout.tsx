import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";

import "./marketing.css";
import DonateModal from "../../components/donate-modal";
import LoginModal from "../../components/login-modal";
import SiteHeader from "../../components/site-header";
import { areDonationsEnabled } from "../../lib/donations";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get("xmrcheckout_api_key")?.value;
  const isAuthenticated = Boolean(apiKey);
  const donationsEnabled = areDonationsEnabled();

  return (
    <div>
      <div className="ambient">
        <span className="orb orb-a"></span>
        <span className="orb orb-b"></span>
        <span className="ambient-grid"></span>
      </div>

      <SiteHeader isAuthenticated={isAuthenticated} includeTour />

      {children}

      <Suspense fallback={null}>
        <LoginModal />
      </Suspense>

      <footer className="site-footer">
        <div className="site-footer-copy">
          <p>
            xmrcheckout.com - Non-custodial Monero checkout software. Open source. Self-hostable.
          </p>
          <p>
            <Link
              className="underline underline-offset-4"
              href="https://github.com/xmrcheckout/xmrcheckout"
            >
              GitHub
            </Link>
          </p>
        </div>
        <Suspense fallback={null}>
          <DonateModal donationsEnabled={donationsEnabled} />
        </Suspense>
      </footer>
    </div>
  );
}
