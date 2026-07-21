import { prisma } from "@/lib/prisma";

export type PublicSiteSettings = {
  id: string; businessName: string; phoneDisplay: string; phoneE164: string;
  email: string | null; bookingUrl: string | null;
  heroVideoUrl: string | null; heroPosterUrl: string | null; heroPosterAlt: string | null; locationLabel: string;
  heroEyebrow: string | null; heroHeadlineLineOne: string | null; heroHeadlineLineTwo: string | null; heroBody: string | null; heroPrimaryLabel: string | null; heroPrimaryDestination: string | null; heroSecondaryLabel: string | null; heroSecondaryDestination: string | null; availabilityEnabled: boolean; availabilityLabel: string | null;
  heliosStandardImageStorageKey: string | null; heliosStandardImageUrl: string | null;
  heliosStandardImageAlt: string | null; primaryConversionImageStorageKey: string | null;
  primaryConversionImageUrl: string | null; primaryConversionImageAlt: string | null;
  brandLogoStorageKey: string | null; brandLogoUrl: string | null; brandLogoAlt: string | null;
  brandMonogramStorageKey: string | null; brandMonogramUrl: string | null;
  faviconStorageKey: string | null; faviconUrl: string | null; faviconVersion: number;
  featuredFilmEnabled: boolean; featuredFilmVideoStorageKey: string | null;
  featuredFilmVideoUrl: string | null; featuredFilmPosterStorageKey: string | null;
  featuredFilmPosterUrl: string | null; featuredFilmDestination: string | null;
  serviceArea: string; serviceAreaDescription: string | null;
  footerDescription: string | null; availabilityMessage: string | null;
  standardEyebrow: string | null; standardHeadingLineOne: string | null; standardHeadingLineTwo: string | null; standardBody: string | null;
  workEyebrow: string | null; workHeadingLineOne: string | null; workHeadingLineTwo: string | null; workHeadingAccent: string | null; workBody: string | null; workButtonLabel: string | null; workButtonDestination: string | null; featuredProjectEyebrow: string | null; portfolioEyebrow: string | null; portfolioHeading: string | null; portfolioButtonLabel: string | null; portfolioButtonDestination: string | null;
  approachEyebrow: string | null; approachHeadingLineOne: string | null; approachHeadingLineTwo: string | null; approachBody: string | null; conversionImageCaption: string | null;
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
  heroPosterAlt: "Luxury real estate exterior photographed by Helios Real Estate Media",
  heroEyebrow: "Fort Collins, Colorado",
  heroHeadlineLineOne: "Luxury Marketing",
  heroHeadlineLineTwo: "for Exceptional Homes",
  heroBody: "Photography, cinematic films, aerial imagery, and branding crafted to elevate Northern Colorado's most exceptional homes.",
  heroPrimaryLabel: "Book Now",
  heroPrimaryDestination: null,
  heroSecondaryLabel: "View Portfolio",
  heroSecondaryDestination: "/portfolio",
  availabilityEnabled: false,
  availabilityLabel: "Now booking",
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
  faviconStorageKey: null,
  faviconUrl: null,
  faviconVersion: 0,
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
  standardEyebrow: "The Helios Standard",
  standardHeadingLineOne: "Presentation",
  standardHeadingLineTwo: "Changes Perception.",
  standardBody: "Exceptional homes deserve more than documentation. They deserve a presentation that shapes how they are seen, remembered, and valued.",
  workEyebrow: "Our Work",
  workHeadingLineOne: "Crafted to",
  workHeadingLineTwo: "Capture",
  workHeadingAccent: "Attention.",
  workBody: "Every image, every frame, and every film is crafted to elevate perception, command attention, and inspire confidence before the first showing.",
  workButtonLabel: "Explore Portfolio",
  workButtonDestination: "/portfolio",
  featuredProjectEyebrow: "Featured Project",
  portfolioEyebrow: "Complete Portfolio",
  portfolioHeading: "Explore the Full Collection.",
  portfolioButtonLabel: "View Complete Portfolio",
  portfolioButtonDestination: "/portfolio",
  approachEyebrow: "Our Approach",
  approachHeadingLineOne: "We Build",
  approachHeadingLineTwo: "Perceived Value.",
  approachBody: "Every listing is treated like a campaign. Every image, frame, and film is shaped to capture attention, create emotion, and elevate the way a property is perceived.",
  conversionImageCaption: "Presentation shapes perception.",
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
