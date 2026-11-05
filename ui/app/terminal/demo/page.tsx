import type { Metadata, Viewport } from "next";
import TerminalClient from "../../../components/terminal-client";
import { getI18n } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("terminal.demoMetaTitle"),
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: "#f8f2e9" };

export default function TerminalDemoPage() {
  return <TerminalClient demo />;
}
