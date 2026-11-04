import type { Metadata } from "next";
import { Crimson_Pro, Space_Grotesk } from "next/font/google";
import "./globals.css";
import I18nProvider from "../components/i18n-provider";
import { getCatalog } from "../lib/i18n/catalogs";
import { getI18n } from "../lib/i18n/server";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost"
).replace(/\/+$/, "");
const siteName = "XMR Checkout";
const openGraphLocales = { en: "en_US", es: "es_ES", ru: "ru_RU", de: "de_DE", fr: "fr_FR", pt: "pt_BR", it: "it_IT", pl: "pl_PL" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const title = t("site.defaultTitle");
  const description = t("site.description");
  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: "%s | XMR Checkout" },
    description,
    openGraph: {
      type: "website",
      locale: openGraphLocales[locale],
      url: siteUrl,
      siteName,
      title,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, t } = await getI18n();
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    description: t("site.description"),
    inLanguage: locale,
  };
  return (
    <html lang={locale} className={`${spaceGrotesk.variable} ${crimsonPro.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">{t("site.skipLink")}</a>
        <I18nProvider locale={locale} messages={getCatalog(locale)}>
          {children}
        </I18nProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
