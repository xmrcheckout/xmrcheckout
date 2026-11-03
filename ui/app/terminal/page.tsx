import type { Metadata, Viewport } from "next";
import TerminalClient from "../../components/terminal-client";

export const metadata: Metadata = {
  title: "Terminal",
  robots: { index: false, follow: false },
  manifest: "/terminal.webmanifest",
  appleWebApp: { capable: true, title: "Monero terminal", statusBarStyle: "default" },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#f8f2e9" };

export default function TerminalPage() {
  return <TerminalClient />;
}
