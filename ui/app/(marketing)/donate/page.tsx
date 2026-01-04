import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Donate",
};

export default function DonatePage() {
  const donationsEnabled = process.env.NEXT_PUBLIC_DONATIONS_ENABLED === "true";
  if (!donationsEnabled) {
    notFound();
  }
  redirect("/?donate=1");
}
