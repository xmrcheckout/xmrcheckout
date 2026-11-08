import { notFound, redirect } from "next/navigation";

import { donationLink } from "../../../lib/donations";

export const dynamic = "force-dynamic";

// Donations go through one of the founder's payment links.
export default function DonatePage() {
  const link = donationLink();
  if (!link) {
    notFound();
  }
  // Temporary, so browsers follow a changed DONATION_LINK.
  redirect(link);
}
