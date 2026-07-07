export function areDonationsEnabled() {
  return (
    process.env.DONATIONS_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_DONATIONS_ENABLED === "true"
  );
}
