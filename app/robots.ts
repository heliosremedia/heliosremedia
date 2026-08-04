import type { MetadataRoute } from "next";

import { getCanonicalAbsoluteUrl, isProductionIndexable } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();
  if (!isProductionIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/login", "/accept-invite", "/client-portal/"],
    },
    sitemap: getCanonicalAbsoluteUrl("/sitemap.xml", settings.websiteUrl),
  };
}
