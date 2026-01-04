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

export const formatUsdAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
};
