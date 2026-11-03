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

export const formatFiatAmount = (
  value: number | string,
  currency: string,
): string => {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return "";
  }
  const code = currency.trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${code}`;
  }
};

export const formatUsdAmount = (value: number): string =>
  formatFiatAmount(value, "USD");
