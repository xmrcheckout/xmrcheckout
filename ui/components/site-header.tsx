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
  // Brand only: customer payment pages carry no site navigation.
  minimal?: boolean;
};

export default async function SiteHeader({
  isAuthenticated,
  includeTour = false,
  donationsEnabled = false,
  minimal = false,
}: SiteHeaderProps) {
  const { t } = await getI18n();
  const brand = (
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
  );
  if (minimal) {
    return <header className="site-header">{brand}</header>;
  }
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
      {brand}
      <nav className="nav desktop-nav" aria-label={t("nav.primary")}>
        {renderNavigation()}
      </nav>
      <MobileNav>{renderNavigation()}</MobileNav>
    </header>
  );
}
