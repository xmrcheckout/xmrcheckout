import Link from "next/link";

import "../(marketing)/marketing.css";
import SiteHeader from "../../components/site-header";
import { areDonationsEnabled } from "../../lib/donations";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const donationsEnabled = areDonationsEnabled();

  return (
    <div>
      <SiteHeader donationsEnabled={donationsEnabled} isAuthenticated />
      {children}
      <footer className="site-footer">
        <div className="site-footer-copy">
          <p>xmrcheckout.com - Non-custodial Monero checkout software.</p>
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
