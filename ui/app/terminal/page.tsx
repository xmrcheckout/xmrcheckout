import type { Metadata, Viewport } from "next";
import TerminalClient from "../../components/terminal-client";
import { getI18n } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("terminal.metaTitle"),
    robots: { index: false, follow: false },
    manifest: "/terminal.webmanifest",
    appleWebApp: { capable: true, title: t("terminal.appTitle"), statusBarStyle: "default" },
    referrer: "no-referrer",
  };
}

export const viewport: Viewport = { themeColor: "#f8f2e9" };

export default function TerminalPage() {
  return <TerminalClient />;
}
