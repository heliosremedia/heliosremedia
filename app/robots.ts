import type { MetadataRoute } from "next";

import { getCanonicalAbsoluteUrl, isProductionIndexable } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

// Never reuse one host's successful or fail-closed robots response for another.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isProductionIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  let settings;
  try {
    settings = await getSiteSettings();
  } catch (error) {
    if (!tenantContextEnabled()) throw error;
    // Studio-only, unknown and temporarily unresolvable company hosts must
    // not advertise another site's sitemap or allow crawling by default.
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
