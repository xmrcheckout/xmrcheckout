import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "../../../lib/i18n/server";
import { dashboardDestination } from "../../../lib/wallet-connection";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.connectWallet") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(`/?login=1&next=${encodeURIComponent(dashboardDestination(next))}`);
}
