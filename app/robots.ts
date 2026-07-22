import type { MetadataRoute } from "next";

import { getAbsoluteUrl, getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/login", "/accept-invite", "/client-portal/"],
    },
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
