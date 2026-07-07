import Image from "next/image";
import Link from "next/link";

import { logoutAction } from "../app/(app)/dashboard/actions";
import { LoginTrigger } from "./login-modal";
import NavLink from "./nav-link";

type SiteHeaderProps = {
  isAuthenticated: boolean;
  includeTour?: boolean;
};

export default function SiteHeader({
  isAuthenticated,
  includeTour = false,
}: SiteHeaderProps) {
  const links = [
    { href: "/invoice", label: "Check Invoice" },
    ...(includeTour ? [{ href: "/tour", label: "Tour" }] : []),
    { href: "/docs", label: "Documentation" },
    { href: "/faq", label: "FAQ" },
    ...(isAuthenticated ? [{ href: "/dashboard", label: "Dashboard" }] : []),
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
          <button type="submit">Log out</button>
        </form>
      ) : (
        <LoginTrigger className="nav-primary">Connect view-only wallet</LoginTrigger>
      )}
    </>
  );

  return (
    <header className="site-header">
      <div className="brand">
        <Link href="/" aria-label="XMR Checkout home">
          <Image
            className="brand-logo"
            src="/logo.png"
            alt="XMR Checkout logo"
            width={128}
            height={128}
            priority
          />
        </Link>
        <Link className="name" href="/">
          XMR Checkout
        </Link>
      </div>
      <nav className="nav desktop-nav" aria-label="Primary navigation">
        {renderNavigation()}
      </nav>
      <details className="mobile-nav">
        <summary aria-label="Open navigation menu">Menu</summary>
        <nav className="mobile-nav-panel" aria-label="Mobile navigation">
          {renderNavigation()}
        </nav>
      </details>
    </header>
  );
}
