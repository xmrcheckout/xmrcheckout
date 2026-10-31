const addressPattern = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

export function walletFormatErrors(address: string, viewKey: string) {
  const primary = address.trim();
  const key = viewKey.trim();
  return {
    address: !primary ? "Enter your primary address."
      : !primary.startsWith("4") ? "Use a primary address starting with 4. Subaddresses starting with 8 cannot connect."
        : primary.length !== 95 ? "The primary address must contain 95 characters."
          : !addressPattern.test(primary) ? "The primary address contains an unsupported character." : null,
    viewKey: !key ? "Enter your private view key."
      : key.length !== 64 ? "The private view key must contain 64 hexadecimal characters."
        : !/^[0-9a-fA-F]{64}$/.test(key) ? "Use only hexadecimal characters (0–9 and a–f) for the private view key." : null,
  };
}

// Only the dashboard and its known non-secret filters can be a login destination.
const dashboardFilters = new Set(["tab", "webhook_tab", "status", "sort", "order", "page", "per_page", "archived", "q"]);
export function dashboardDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/dashboard") || value.includes("\\") || /[\r\n]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://checkout.invalid");
    if (url.origin !== "https://checkout.invalid" || url.pathname !== "/dashboard") return "/dashboard";
    const query = new URLSearchParams();
    for (const [key, entry] of url.searchParams) if (dashboardFilters.has(key)) query.append(key, entry);
    return `/dashboard${query.size ? `?${query}` : ""}`;
  } catch { return "/dashboard"; }
}
