// Supported interface languages. English is the source language: every other
// catalog is merged over it, so a missing translation shows English text.
export const locales = ["en", "es", "ru", "de", "fr", "pt", "it", "pl"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeCookie = "xmrcheckout_locale";

// Each language is named in itself so visitors can find their own.
export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  pt: "Português",
  it: "Italiano",
  pl: "Polski",
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

/** Picks the best supported locale from an Accept-Language header. */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim().match(/^q=([0-9.]+)$/)?.[1])
        .find(Boolean);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
