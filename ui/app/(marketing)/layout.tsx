import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";

import "./marketing.css";
import DonateModal from "../../components/donate-modal";
import LoginModal, { LoginTrigger } from "../../components/login-modal";
import { logoutAction } from "../(app)/dashboard/actions";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get("xmrcheckout_api_key")?.value;
  const isAuthenticated = Boolean(apiKey);

  return (
    <div>
      <div className="ambient">
        <span className="orb orb-a"></span>
        <span className="orb orb-b"></span>
        <span className="ambient-grid"></span>
      </div>

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
        <nav className="nav">
          <Link href="/invoice">Check Invoice</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/faq">FAQ</Link>
          {isAuthenticated ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <form action={logoutAction}>
                <button type="submit">Log out</button>
              </form>
            </>
          ) : (
            <LoginTrigger className="nav-primary">Log in</LoginTrigger>
          )}
        </nav>
      </header>

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
          <DonateModal />
        </Suspense>
      </footer>
    </div>
  );
}
