import type { Metadata } from "next";

import { getCanonicalAbsoluteUrl, isProductionIndexable } from "@/lib/site";
import type { PublicSiteSettings } from "@/lib/site-settings";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  settings: PublicSiteSettings;
  image?: string | null;
  imageAlt?: string | null;
  type?: "website" | "article";
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  settings,
  image,
  imageAlt,
  type = "website",
  noIndex = false,
}: PageMetadataInput): Metadata {
  const configuredDefault = settings.defaultSocialImageUrl
    ? `${settings.defaultSocialImageUrl}${settings.defaultSocialImageUrl.includes("?") ? "&" : "?"}v=${settings.defaultSocialImageVersion}`
    : null;
  const socialImage = image || configuredDefault || "/work/modern-retreat.jpg";
  const canonical = getCanonicalAbsoluteUrl(path, settings.websiteUrl);
  const absoluteImage = getCanonicalAbsoluteUrl(socialImage, settings.websiteUrl);
  const cleanImagePath = absoluteImage.split("?")[0].toLowerCase();
  const imageType = cleanImagePath.endsWith(".png") ? "image/png"
    : cleanImagePath.endsWith(".webp") ? "image/webp"
      : cleanImagePath.endsWith(".avif") ? "image/avif"
        : cleanImagePath.endsWith(".jpg") || cleanImagePath.endsWith(".jpeg") ? "image/jpeg"
          : undefined;
  const alt = imageAlt || (configuredDefault && socialImage === configuredDefault
    ? settings.defaultSocialImageAlt
    : null) || settings.businessName;
  const images = [{
    url: absoluteImage,
    secureUrl: absoluteImage,
    alt,
    ...(imageType ? { type: imageType } : {}),
    ...(configuredDefault && socialImage === configuredDefault
      ? { width: 1200, height: 630 }
      : socialImage === "/work/modern-retreat.jpg" ? { width: 7008, height: 4672 } : {}),
  }];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type,
      url: canonical,
      siteName: settings.businessName,
      locale: "en_US",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: absoluteImage, alt }],
    },
    ...(noIndex || !isProductionIndexable() ? { robots: { index: false, follow: false } } : {}),
  };
}
