import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";

import "../app/(marketing)/marketing.css";
import LoginModal from "./login-modal";
import LanguageSwitcher from "./language-switcher";
import SiteHeader from "./site-header";
import SourceLinks from "./source-links";
import { areDonationsEnabled } from "../lib/donations";
import { getI18n } from "../lib/i18n/server";

export default async function MarketingShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get("xmrcheckout_api_key")?.value;
  const isAuthenticated = Boolean(apiKey);
  const donationsEnabled = areDonationsEnabled();
  const { t } = await getI18n();

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
            {t("footer.tagline")}
          </p>
          <SourceLinks />
          <LanguageSwitcher />
        </div>
        {donationsEnabled ? (
          <div className="donate-entry">
            <Link className="donate-link" href="/donate">
              {t("footer.donate")}
            </Link>
          </div>
        ) : null}
      </footer>
    </div>
  );
}
