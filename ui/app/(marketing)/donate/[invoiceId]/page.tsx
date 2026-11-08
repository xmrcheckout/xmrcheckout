import { permanentRedirect } from "next/navigation";

// Older donation invoices are ordinary invoices, served on the invoice page.
export default async function DonateStatusDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  permanentRedirect(`/invoice/${encodeURIComponent(invoiceId)}`);
}
