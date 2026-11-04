"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { getTranslator } from "../lib/i18n/catalogs";
import { defaultLocale, matchLocale, type Locale } from "../lib/i18n/config";

// The root layout, its stylesheet, and the translation provider may be
// unavailable here, so the language comes from the browser's preferences.
const subscribe = () => () => {};
const browserLocale = (): Locale => matchLocale(navigator.languages?.join(",") || navigator.language || "");

export default function GlobalError() {
  const locale = useSyncExternalStore(subscribe, browserLocale, () => defaultLocale);
  const t = getTranslator(locale);
  return <html lang={locale}><body style={{ margin: 0, background: "#f8f2e9", color: "#101217", fontFamily: "Arial, sans-serif" }}>
    <main id="main-content" tabIndex={-1} style={{ maxWidth: "40rem", margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.6 }}>
      <h1>{t("error.title")}</h1>
      <p>{t("error.description")}</p>
      <button style={{ minHeight: 44, padding: "0.75rem 1.5rem", borderRadius: "2rem", background: "#101217", color: "#f8f2e9", font: "inherit", cursor: "pointer" }} onClick={() => window.location.reload()}>{t("error.tryAgain")}</button>
      <p><Link style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "inherit" }} href="/">{t("common.returnHome")}</Link></p>
    </main>
  </body></html>;
}
