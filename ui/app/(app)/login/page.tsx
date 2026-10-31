import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dashboardDestination } from "../../../lib/wallet-connection";

export const metadata: Metadata = {
  title: "Connect wallet",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(`/?login=1&next=${encodeURIComponent(dashboardDestination(next))}`);
}
