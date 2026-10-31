import type { Metadata } from "next";
import { Crimson_Pro, Space_Grotesk } from "next/font/google";
import "./globals.css";

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
const siteDescription =
  "Accept Monero with your own wallet using self-hosted invoice pages, view-only payment detection, APIs, and webhooks.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Self-Hosted Monero Checkout for Merchants | XMR Checkout",
    template: "%s | XMR Checkout",
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: "Self-Hosted Monero Checkout for Merchants | XMR Checkout",
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: "Self-Hosted Monero Checkout for Merchants | XMR Checkout",
    description: siteDescription,
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: siteUrl,
  description: siteDescription,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${crimsonPro.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
