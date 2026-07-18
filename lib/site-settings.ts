import { prisma } from "@/lib/prisma";

export type PublicSiteSettings = {
  id: string; businessName: string; phoneDisplay: string; phoneE164: string;
  email: string | null; bookingUrl: string | null;
  heroVideoUrl: string | null; heroPosterUrl: string | null; locationLabel: string;
  serviceArea: string; serviceAreaDescription: string | null;
  footerDescription: string | null; availabilityMessage: string | null;
  websiteUrl: string | null; instagramUrl: string | null; facebookUrl: string | null;
  youtubeUrl: string | null; linkedinUrl: string | null;
  defaultSeoTitle: string; defaultSeoDescription: string;
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
