import type { Metadata } from "next";
import type { Locale } from "./i18n/config";

export const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost").replace(/\/+$/, "");
export const siteName = "XMR Checkout";
export const openGraphLocales = { en: "en_US", es: "es_ES", ru: "ru_RU", de: "de_DE", fr: "fr_FR", pt: "pt_BR", it: "it_IT", pl: "pl_PL", zh: "zh_CN", uk: "uk_UA", cs: "cs_CZ" } as const;

export function publicPageMetadata({ title, description, path, locale, type = "website" }: {
  title: string; description: string; path: string; locale: Locale; type?: "website" | "article";
}): Metadata {
  const fullTitle = title.endsWith(` | ${siteName}`) ? title : `${title} | ${siteName}`;
  const url = new URL(path, `${siteOrigin}/`).toString();
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    openGraph: { type, locale: openGraphLocales[locale], url, siteName, title: fullTitle, description },
    twitter: { card: "summary", title: fullTitle, description },
  };
}
