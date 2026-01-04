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

export const metadata: Metadata = {
  title: {
    default: "XMR Checkout | Home",
    template: "XMR Checkout | %s",
  },
  description: "Non-custodial Monero checkout with view-only detection.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${crimsonPro.variable}`}>
      <body>{children}</body>
    </html>
  );
}
