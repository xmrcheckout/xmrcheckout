import Link from "next/link";
import { Suspense } from "react";

import "../(marketing)/marketing.css";
import DonateModal from "../../components/donate-modal";
import SiteHeader from "../../components/site-header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SiteHeader isAuthenticated />
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
        <Suspense fallback={null}>
          <DonateModal />
        </Suspense>
      </footer>
    </div>
  );
}
