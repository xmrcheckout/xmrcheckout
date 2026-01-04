import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "http://localhost";
const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
const donationsEnabled = process.env.NEXT_PUBLIC_DONATIONS_ENABLED === "true";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${normalizedSiteUrl}/`,
      lastModified,
    },
    {
      url: `${normalizedSiteUrl}/docs`,
      lastModified,
    },
    {
      url: `${normalizedSiteUrl}/docs/integrations`,
      lastModified,
    },
    {
      url: `${normalizedSiteUrl}/faq`,
      lastModified,
    },
    {
      url: `${normalizedSiteUrl}/invoice`,
      lastModified,
    },
  ];
  if (donationsEnabled) {
    entries.push({
      url: `${normalizedSiteUrl}/donate`,
      lastModified,
    });
  }
  return entries;
}
