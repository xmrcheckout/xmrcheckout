import Link from "next/link";

import "../(marketing)/marketing.css";
import SiteHeader from "../../components/site-header";
import LanguageSwitcher from "../../components/language-switcher";
import { areDonationsEnabled } from "../../lib/donations";
import { getI18n } from "../../lib/i18n/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const donationsEnabled = areDonationsEnabled();
  const { t } = await getI18n();

  return (
    <div>
      <SiteHeader donationsEnabled={donationsEnabled} isAuthenticated />
      {children}
      <footer className="site-footer">
        <div className="site-footer-copy">
          <p>{t("footer.tagline")}</p>
          <p>
            <Link
              className="underline underline-offset-4"
              href="https://github.com/xmrcheckout/xmrcheckout"
            >
              GitHub
            </Link>
          </p>
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
