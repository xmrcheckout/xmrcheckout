import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";

import "../app/(marketing)/marketing.css";
import LoginModal from "./login-modal";
import SiteHeader from "./site-header";
import { areDonationsEnabled } from "../lib/donations";

export default async function MarketingShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get("xmrcheckout_api_key")?.value;
  const isAuthenticated = Boolean(apiKey);
  const donationsEnabled = areDonationsEnabled();

  return (
    <div className="marketing-shell">
      <div className="ambient">
        <span className="orb orb-a"></span>
        <span className="orb orb-b"></span>
        <span className="ambient-grid"></span>
      </div>

      <SiteHeader
        donationsEnabled={donationsEnabled}
        isAuthenticated={isAuthenticated}
        includeTour
      />

      {children}

      <Suspense fallback={null}>
        <LoginModal />
      </Suspense>

      <footer className="site-footer site-footer-dark">
        <div className="site-footer-copy">
          <p>
            XMR Checkout · Open source. Self-hostable.
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
        {donationsEnabled ? (
          <div className="donate-entry">
            <Link className="donate-link" href="/donate">
              Donate
            </Link>
          </div>
        ) : null}
      </footer>
    </div>
  );
}
