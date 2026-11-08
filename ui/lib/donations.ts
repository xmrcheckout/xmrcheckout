// The founder's donation payment link: a relative /pay/<token> path or an https URL.
export function donationLink(): string | null {
  const value = (process.env.DONATION_LINK || process.env.NEXT_PUBLIC_DONATION_LINK || "").trim();
  if (/^\/pay\/[A-Za-z0-9_-]+$/.test(value) || /^https:\/\/[^\s]+$/.test(value)) {
    return value;
  }
  return null;
}

export function areDonationsEnabled() {
  return donationLink() !== null;
}
