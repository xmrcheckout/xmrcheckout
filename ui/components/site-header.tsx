import Image from "next/image";
import Link from "next/link";

import { logoutAction } from "../app/(app)/dashboard/actions";
import { LoginTrigger } from "./login-modal";
import MobileNav from "./mobile-nav";
import NavLink from "./nav-link";
import { getI18n } from "../lib/i18n/server";

type SiteHeaderProps = {
  isAuthenticated: boolean;
  includeTour?: boolean;
  donationsEnabled?: boolean;
};

export default async function SiteHeader({
  isAuthenticated,
  includeTour = false,
  donationsEnabled = false,
}: SiteHeaderProps) {
  const { t } = await getI18n();
  const links = [
    { href: "/invoice", label: t("nav.checkInvoice") },
    ...(includeTour ? [{ href: "/tour", label: t("nav.demo") }] : []),
    { href: "/docs", label: t("nav.docs") },
    { href: "/guides", label: t("nav.guides") },
    { href: "/faq", label: t("nav.faq") },
    ...(donationsEnabled ? [{ href: "/donate", label: t("footer.donate") }] : []),
    ...(isAuthenticated ? [{ href: "/dashboard", label: t("nav.dashboard") }] : []),
  ];

  const renderNavigation = () => (
    <>
      {links.map((link) => (
        <NavLink key={link.href} href={link.href}>
          {link.label}
        </NavLink>
      ))}
      {isAuthenticated ? (
        <form action={logoutAction}>
          <button type="submit">{t("nav.logout")}</button>
        </form>
      ) : (
        <LoginTrigger className="nav-primary">{t("nav.connect")}</LoginTrigger>
      )}
    </>
  );

  return (
    <header className="site-header">
      <div className="brand">
        <Link href="/" aria-label={t("nav.homeLabel")}>
          <Image
            className="brand-logo"
            src="/logo.png"
            alt={t("nav.logoAlt")}
            width={128}
            height={128}
            priority
          />
        </Link>
        <Link className="name" href="/">
          XMR Checkout
        </Link>
      </div>
      <nav className="nav desktop-nav" aria-label={t("nav.primary")}>
        {renderNavigation()}
      </nav>
      <MobileNav>{renderNavigation()}</MobileNav>
    </header>
  );
}
