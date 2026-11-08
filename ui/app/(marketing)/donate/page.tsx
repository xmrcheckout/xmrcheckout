import { notFound, permanentRedirect } from "next/navigation";

import { donationLink } from "../../../lib/donations";

export const dynamic = "force-dynamic";

// Donations go through one of the founder's payment links.
export default function DonatePage() {
  const link = donationLink();
  if (!link) {
    notFound();
  }
  permanentRedirect(link);
}
