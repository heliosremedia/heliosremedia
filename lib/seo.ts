import type { Metadata } from "next";

import { getAbsoluteUrl } from "@/lib/site";
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
  const socialImage = image || settings.heroPosterUrl || settings.brandLogoUrl;
  const canonical = getAbsoluteUrl(path);
  const images = socialImage
    ? [{ url: socialImage, alt: imageAlt || settings.heroPosterAlt || settings.businessName }]
    : undefined;

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
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
