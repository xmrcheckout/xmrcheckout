import type { Translate } from "./i18n/translate";

const addressPattern = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

export function walletFormatErrors(address: string, viewKey: string, t: Translate) {
  const primary = address.trim();
  const key = viewKey.trim();
  return {
    address: !primary ? t("login.format.addressEmpty")
      : !primary.startsWith("4") ? t("login.format.addressPrefix")
        : primary.length !== 95 ? t("login.format.addressLength")
          : !addressPattern.test(primary) ? t("login.format.addressChars") : null,
    viewKey: !key ? t("login.format.keyEmpty")
      : key.length !== 64 ? t("login.format.keyLength")
        : !/^[0-9a-fA-F]{64}$/.test(key) ? t("login.format.keyChars") : null,
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
