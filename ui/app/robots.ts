import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "http://localhost";
const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/login", "/api", "/_next", "/invoice/", "/donate/"],
    },
    sitemap: `${normalizedSiteUrl}/sitemap.xml`,
  };
}
