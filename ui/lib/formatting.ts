export const formatXmrAmount = (value: string | number): string => {
  const raw = typeof value === "number" ? value.toString() : value;
  if (!raw) {
    return "";
  }
  const [whole, fraction] = raw.split(".");
  if (!fraction) {
    return raw;
  }
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
};

// XMR amounts are never localized: they are copied into wallets and must keep
// "." decimals with no grouping. Fiat amounts are display-only.
export const formatFiatAmount = (
  value: number | string,
  currency: string,
  locale = "en-US",
): string => {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return "";
  }
  const code = currency.trim().toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${code}`;
  }
};

export const formatUsdAmount = (value: number, locale?: string): string =>
  formatFiatAmount(value, "USD", locale);
