import type { NextConfig } from "next";

const legacyPathRedirects = [
  // Wix pricing and service-page URLs surfaced by Google.
  { source: "/pricing-and-packages", destination: "/services" },
  { source: "/pricing-packages", destination: "/services" },
  { source: "/pricing-plans", destination: "/services" },
  { source: "/plans-pricing", destination: "/services" },
  {
    source: "/photography-cinematic-video",
    destination: "/services",
  },
  {
    source: "/photography-and-cinematic-video",
    destination: "/services",
  },
  {
    source: "/real-estate-photography-and-video",
    destination: "/services",
  },

  // Wix company-page URLs that were renamed in the new site.
  { source: "/about-us", destination: "/about" },
  { source: "/contact-us", destination: "/contact" },

  // Legacy local-page URLs now managed under /locations.
  { source: "/fort-collins", destination: "/locations/fort-collins" },
  {
    source: "/real-estate-photography-fort-collins",
    destination: "/locations/fort-collins",
  },
  {
    source: "/real-estate-photography-loveland",
    destination: "/locations/loveland",
  },
  {
    source: "/real-estate-photography-greeley",
    destination: "/locations/greeley",
  },
  {
    source: "/real-estate-photography-windsor",
    destination: "/locations/windsor",
  },
  {
    source: "/real-estate-photography-timnath",
    destination: "/locations/timnath",
  },
  {
    source: "/real-estate-photography-severance",
    destination: "/locations/severance",
  },
  {
    source: "/real-estate-photography-boulder",
    destination: "/locations/boulder",
  },
  {
    source: "/real-estate-photography-johnstown",
    destination: "/locations/johnstown",
  },
] as const;

const legacyDomainRedirects = (process.env.LEGACY_PUBLIC_HOSTS || "heliosremedia.com,www.heliosremedia.com")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const canonicalPublicUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.heliosrealestatemedia.com").replace(/\/+$/, "");

function getR2ImagePattern() {
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!publicUrl) {
    return null;
  }

  try {
    const url = new URL(publicUrl);
    const pathname = url.pathname.replace(/\/$/, "");

    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: `${pathname}/**`,
    };
  } catch {
    return null;
  }
}

const r2ImagePattern = getR2ImagePattern();

const videoPosterPatterns = [
  {
    protocol: "https" as const,
    hostname: "videodelivery.net",
    port: "",
    pathname: "/**/thumbnails/**",
  },
  {
    protocol: "https" as const,
    hostname: "i.ytimg.com",
    port: "",
    pathname: "/vi/**",
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      ...legacyDomainRedirects.map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: `${canonicalPublicUrl}/:path*`,
        permanent: true,
      })),
      ...legacyPathRedirects.map(({ source, destination }) => ({
        source,
        destination,
        permanent: true,
      })),
    ];
  },
  images: {
    deviceSizes: [320, 375, 480, 640, 768, 1024, 1200, 1440, 1600, 1920],
    formats: ["image/webp"],
    minimumCacheTTL: 2678400,
    qualities: [75, 85, 95],
    remotePatterns: [
      ...(r2ImagePattern ? [r2ImagePattern] : []),
      ...videoPosterPatterns,
    ],
  },
};

export default nextConfig;
