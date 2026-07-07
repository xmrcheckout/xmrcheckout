import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { areDonationsEnabled } from "../../../lib/donations";

export const metadata: Metadata = {
  title: "Donate",
};

export default function DonatePage() {
  if (!areDonationsEnabled()) {
    notFound();
  }
  redirect("/?donate=1");
}
