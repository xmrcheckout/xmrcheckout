"use server";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

export type DonationState = {
  error: string | null;
  invoiceId: string | null;
};

export async function createDonationAction(
  _prevState: DonationState,
  formData: FormData
): Promise<DonationState> {
  const donationsEnabled = process.env.NEXT_PUBLIC_DONATIONS_ENABLED === "true";
  if (!donationsEnabled) {
    return { error: "Donations are disabled.", invoiceId: null };
  }
  const amount = Number(formData.get("amount_xmr"));
  if (Number.isNaN(amount) || amount <= 0) {
    return { error: "Enter a valid XMR amount.", invoiceId: null };
  }

  const response = await fetch(`${apiBaseUrl}/api/core/donations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount_xmr: amount }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to create a donation invoice.";
    return { error: message, invoiceId: null };
  }

  const data = (await response.json()) as { id: string };
  return { error: null, invoiceId: data.id };
}
