export const FIAT_CURRENCY_SUGGESTIONS = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "JPY",
  "CNY",
  "HKD",
  "SGD",
  "INR",
  "BRL",
  "MXN",
  "SEK",
  "NOK",
  "DKK",
  "ZAR",
  "PLN",
  "KRW",
];

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  CHF: "🇨🇭",
  JPY: "🇯🇵",
  CNY: "🇨🇳",
  HKD: "🇭🇰",
  SGD: "🇸🇬",
  INR: "🇮🇳",
  BRL: "🇧🇷",
  MXN: "🇲🇽",
  SEK: "🇸🇪",
  NOK: "🇳🇴",
  DKK: "🇩🇰",
  ZAR: "🇿🇦",
  PLN: "🇵🇱",
  KRW: "🇰🇷",
};

export const getCurrencyFlag = (
  code: string | null | undefined
): string | null => {
  if (!code) {
    return null;
  }
  return CURRENCY_FLAGS[code.trim().toUpperCase()] ?? null;
};
