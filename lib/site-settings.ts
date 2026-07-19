import { prisma } from "@/lib/prisma";

export type PublicSiteSettings = {
  id: string; businessName: string; phoneDisplay: string; phoneE164: string;
  email: string | null; bookingUrl: string | null;
  heroVideoUrl: string | null; heroPosterUrl: string | null; locationLabel: string;
  heliosStandardImageStorageKey: string | null; heliosStandardImageUrl: string | null;
  heliosStandardImageAlt: string | null; primaryConversionImageStorageKey: string | null;
  primaryConversionImageUrl: string | null; primaryConversionImageAlt: string | null;
  brandLogoStorageKey: string | null; brandLogoUrl: string | null; brandLogoAlt: string | null;
  brandMonogramStorageKey: string | null; brandMonogramUrl: string | null;
  featuredFilmEnabled: boolean; featuredFilmVideoStorageKey: string | null;
  featuredFilmVideoUrl: string | null; featuredFilmPosterStorageKey: string | null;
  featuredFilmPosterUrl: string | null; featuredFilmDestination: string | null;
  serviceArea: string; serviceAreaDescription: string | null;
  footerDescription: string | null; availabilityMessage: string | null;
  websiteUrl: string | null; instagramUrl: string | null; facebookUrl: string | null;
  youtubeUrl: string | null; linkedinUrl: string | null;
  defaultSeoTitle: string; defaultSeoDescription: string;
  privacyPolicyPublished: boolean; termsOfServicePublished: boolean;
};

export const defaultSiteSettings: PublicSiteSettings = {
  id: "default",
  businessName: "Helios Real Estate Media",
  phoneDisplay: "970.682.5533",
  phoneE164: "+19706825533",
  email: null,
  bookingUrl: null,
  heroVideoUrl: null,
  heroPosterUrl: "/work/featured-estate.jpg",
  heliosStandardImageStorageKey: null,
  heliosStandardImageUrl: null,
  heliosStandardImageAlt: "Luxury interior photographed by Helios Real Estate Media",
  primaryConversionImageStorageKey: null,
  primaryConversionImageUrl: null,
  primaryConversionImageAlt: "Architectural living room photographed by Helios Real Estate Media",
  brandLogoStorageKey: null,
  brandLogoUrl: null,
  brandLogoAlt: "Helios Real Estate Media",
  brandMonogramStorageKey: null,
  brandMonogramUrl: null,
  featuredFilmEnabled: false,
  featuredFilmVideoStorageKey: null,
  featuredFilmVideoUrl: null,
  featuredFilmPosterStorageKey: null,
  featuredFilmPosterUrl: null,
  featuredFilmDestination: "/portfolio?service=cinematic-films",
  locationLabel: "Fort Collins, Colorado",
  serviceArea: "Northern Colorado",
  serviceAreaDescription: "Serving Fort Collins, Loveland, Windsor, Timnath, Greeley, Wellington, Berthoud, Boulder, and surrounding Northern Colorado communities.",
  footerDescription: "Photography, cinematic film, aerial media, and marketing content created for real estate professionals across Northern Colorado.",
  availabilityMessage: null,
  websiteUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  youtubeUrl: null,
  linkedinUrl: null,
  defaultSeoTitle: "Helios Real Estate Media",
  defaultSeoDescription: "Luxury real estate photography, cinematic films, and branding for Northern Colorado's finest homes.",
  privacyPolicyPublished: false,
  termsOfServicePublished: false,
};

export async function getSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: "default" }, select: Object.fromEntries(Object.keys(defaultSiteSettings).map((key) => [key, true])) as Record<keyof PublicSiteSettings, true> });
    return settings ?? defaultSiteSettings;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Using default site settings because the database is unavailable.", error);
    return defaultSiteSettings;
  }
}
