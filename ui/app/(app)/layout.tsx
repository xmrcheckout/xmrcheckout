import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import "../(marketing)/marketing.css";
import DonateModal from "../../components/donate-modal";
import { logoutAction } from "./dashboard/actions";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
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
          <Link href="/dashboard">Dashboard</Link>
          <form action={logoutAction}>
            <button type="submit">Log out</button>
          </form>
        </nav>
      </header>
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
