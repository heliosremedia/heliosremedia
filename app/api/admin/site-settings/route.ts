import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteContentImage, verifyContentImage } from "@/lib/content-image-storage";
import { getAdminSession } from "@/lib/auth/session";

function text(value: unknown, max: number, required = false) { const result = typeof value === "string" ? value.trim() : ""; if ((required && !result) || result.length > max) throw new Error("INVALID_TEXT"); return result || null; }
type UrlKind = "website" | "instagram" | "facebook" | "youtube" | "linkedin";

function url(value: unknown, kind: UrlKind = "website") {
  const result = text(value, 1000);
  if (!result) return null;

  const explicitlyQualified = /^https?:\/\//i.test(result);
  let candidate = result;
  if (!explicitlyQualified) {
    const handle = candidate.replace(/^@/, "");
    const looksLikeAddress = candidate.includes(".") || candidate.includes("/");

    if (looksLikeAddress) candidate = `https://${candidate.replace(/^\/+/, "")}`;
    else if (kind === "instagram") candidate = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
    else if (kind === "facebook") candidate = `https://www.facebook.com/${encodeURIComponent(handle)}`;
    else if (kind === "youtube") candidate = `https://www.youtube.com/@${encodeURIComponent(handle)}`;
    else if (kind === "linkedin") candidate = `https://www.linkedin.com/in/${encodeURIComponent(handle)}`;
    else candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("INVALID_URL");
    // Explicit URLs are user-owned content. Validate them without rewriting
    // their casing, path, query, fragment, or trailing-slash presentation.
    return explicitlyQualified ? result : parsed.toString();
  } catch {
    throw new Error("INVALID_URL");
  }
}
function assetUrl(value: unknown) { const result = text(value, 1000); if (!result) return null; if (result.startsWith("/") && !result.startsWith("//")) return result; return url(result); }
function cards(value: unknown, max = 8) {
  if (!Array.isArray(value) || value.length > max) throw new Error("INVALID_CARDS");
  return value.map((item, index) => { const entry = item as Record<string, unknown>; return { number: text(entry.number, 12) || String(index + 1).padStart(2, "0"), title: text(entry.title, 100, true)!, description: text(entry.description, 500, true)!, published: entry.published !== false }; });
}
function navigation(value: unknown) {
  if (!Array.isArray(value) || value.length > 20) throw new Error("INVALID_NAVIGATION");
  return value.map((item) => {
    const entry = item as Record<string, unknown>;
    return {
      label: text(entry.label, 80, true)!,
      href: assetUrl(entry.href) || "/",
      newTab: Boolean(entry.newTab),
      published: entry.published !== false,
      ...(typeof entry.displayInNav === "boolean" ? { displayInNav: entry.displayInNav } : {}),
      ...(typeof entry.displayInFooter === "boolean" ? { displayInFooter: entry.displayInFooter } : {}),
    };
  });
}
function bookingMode(value: unknown) {
  if (!["ONLINE", "UNAVAILABLE", "PAUSED"].includes(String(value))) throw new Error("INVALID_BOOKING_MODE");
  return value as "ONLINE" | "UNAVAILABLE" | "PAUSED";
}
function optionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || (session.role !== "OWNER" && session.role !== "ADMIN")) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.updateScope === "homepage-navigation") {
      const items = navigation(body.navigation);
      const settings = await prisma.siteSettings.update({
        where: { id: "default" },
        data: {
          headerNavigation: items,
          footerNavigation: items,
          workspaceId: session.workspaceId,
        },
      });
      revalidatePath("/", "layout");
      revalidatePath("/admin/homepage");
      return NextResponse.json({ success: true, settings });
    }
    if (body.updateScope === "homepage-structure") {
      const settings = await prisma.siteSettings.update({
        where: { id: "default" },
        data: {
          standardPrinciples: cards(body.standardPrinciples, 6),
          approachCards: cards(body.approachCards, 6),
          workspaceId: session.workspaceId,
        },
      });
      revalidatePath("/", "layout");
      revalidatePath("/admin/homepage");
      return NextResponse.json({ success: true, settings });
    }
    const phoneE164 = text(body.phoneE164, 30, true)!;
    if (!/^\+[1-9]\d{7,14}$/.test(phoneE164)) throw new Error("INVALID_PHONE");
    const email = text(body.email, 320);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
    const brandLogoStorageKey = text(body.brandLogoStorageKey, 1000);
    if (brandLogoStorageKey && !brandLogoStorageKey.startsWith("site/brand/")) throw new Error("INVALID_LOGO_KEY");
    const brandMonogramStorageKey = text(body.brandMonogramStorageKey, 1000);
    if (brandMonogramStorageKey && !brandMonogramStorageKey.startsWith("site/brand/")) throw new Error("INVALID_MONOGRAM_KEY");
    const faviconStorageKey = text(body.faviconStorageKey, 1000);
    if (faviconStorageKey && !faviconStorageKey.startsWith("site/brand/favicon-")) throw new Error("INVALID_FAVICON_KEY");
    const defaultSocialImageStorageKey = text(body.defaultSocialImageStorageKey, 1000);
    if (defaultSocialImageStorageKey && !defaultSocialImageStorageKey.startsWith("site/brand/social-")) throw new Error("INVALID_SOCIAL_IMAGE_KEY");
    const heliosStandardImageStorageKey = text(body.heliosStandardImageStorageKey, 1000);
    if (heliosStandardImageStorageKey && !heliosStandardImageStorageKey.startsWith("site/homepage/helios-standard/")) throw new Error("INVALID_HOMEPAGE_IMAGE_KEY");
    const primaryConversionImageStorageKey = text(body.primaryConversionImageStorageKey, 1000);
    if (primaryConversionImageStorageKey && !primaryConversionImageStorageKey.startsWith("site/homepage/primary-conversion/")) throw new Error("INVALID_HOMEPAGE_IMAGE_KEY");
    const existing = await prisma.siteSettings.findUnique({ where: { id: "default" }, select: { brandLogoStorageKey: true, brandMonogramStorageKey: true, faviconStorageKey: true, faviconVersion: true, defaultSocialImageStorageKey: true, defaultSocialImageVersion: true, heliosStandardImageStorageKey: true, primaryConversionImageStorageKey: true } });
    if (brandLogoStorageKey !== existing?.brandLogoStorageKey) await verifyContentImage(brandLogoStorageKey);
    if (brandMonogramStorageKey !== existing?.brandMonogramStorageKey) await verifyContentImage(brandMonogramStorageKey);
    if (faviconStorageKey !== existing?.faviconStorageKey) await verifyContentImage(faviconStorageKey);
    if (defaultSocialImageStorageKey !== existing?.defaultSocialImageStorageKey) await verifyContentImage(defaultSocialImageStorageKey);
    if (heliosStandardImageStorageKey !== existing?.heliosStandardImageStorageKey) await verifyContentImage(heliosStandardImageStorageKey);
    if (primaryConversionImageStorageKey !== existing?.primaryConversionImageStorageKey) await verifyContentImage(primaryConversionImageStorageKey);
    const data = {
      businessName: text(body.businessName, 160, true)!, phoneDisplay: text(body.phoneDisplay, 40, true)!, phoneE164, email,
      bookingUrl: url(body.bookingUrl), bookingMode: bookingMode(body.bookingMode),
      bookingHeadline: text(body.bookingHeadline, 180), bookingExplanation: text(body.bookingExplanation, 1200),
      bookingEstimatedRestoreAt: optionalDate(body.bookingEstimatedRestoreAt),
      bookingContactPhone: text(body.bookingContactPhone, 40), bookingContactEmail: text(body.bookingContactEmail, 320),
      bookingBannerMessage: text(body.bookingBannerMessage, 280), bookingBannerEnabled: body.bookingBannerEnabled !== false,
      bookingRequestEnabled: body.bookingRequestEnabled !== false,
      bookingHandoffEnabled: body.bookingHandoffEnabled !== false,
      bookingProviderName: text(body.bookingProviderName, 120),
      bookingEyebrow: text(body.bookingEyebrow, 120),
      bookingHandoffHeadline: text(body.bookingHandoffHeadline, 180),
      bookingHandoffExplanation: text(body.bookingHandoffExplanation, 1200),
      bookingPrimaryLabel: text(body.bookingPrimaryLabel, 80),
      bookingCallLabel: text(body.bookingCallLabel, 80),
      bookingEmailLabel: text(body.bookingEmailLabel, 80),
      bookingPhoneVisible: body.bookingPhoneVisible !== false,
      bookingEmailVisible: body.bookingEmailVisible !== false,
      heroVideoUrl: assetUrl(body.heroVideoUrl), heroPosterUrl: assetUrl(body.heroPosterUrl), heroPosterAlt: text(body.heroPosterAlt, 240),
      heroEyebrow: text(body.heroEyebrow, 120), heroHeadlineLineOne: text(body.heroHeadlineLineOne, 120), heroHeadlineLineTwo: text(body.heroHeadlineLineTwo, 120), heroBody: text(body.heroBody, 420), heroPrimaryLabel: text(body.heroPrimaryLabel, 80), heroPrimaryDestination: assetUrl(body.heroPrimaryDestination), heroSecondaryLabel: text(body.heroSecondaryLabel, 80), heroSecondaryDestination: assetUrl(body.heroSecondaryDestination), availabilityEnabled: Boolean(body.availabilityEnabled), availabilityLabel: text(body.availabilityLabel, 80), availabilityStatus: ["AVAILABLE", "ADVISORY", "CRITICAL"].includes(String(body.availabilityStatus).toUpperCase()) ? String(body.availabilityStatus).toUpperCase() as "AVAILABLE" | "ADVISORY" | "CRITICAL" : "AVAILABLE",
      heliosStandardImageStorageKey, heliosStandardImageUrl: assetUrl(body.heliosStandardImageUrl), heliosStandardImageAlt: text(body.heliosStandardImageAlt, 240),
      primaryConversionImageStorageKey, primaryConversionImageUrl: assetUrl(body.primaryConversionImageUrl), primaryConversionImageAlt: text(body.primaryConversionImageAlt, 240),
      brandLogoStorageKey, brandLogoUrl: assetUrl(body.brandLogoUrl), brandLogoAlt: text(body.brandLogoAlt, 240),
      brandMonogramStorageKey, brandMonogramUrl: assetUrl(body.brandMonogramUrl),
      faviconStorageKey, faviconUrl: assetUrl(body.faviconUrl), faviconVersion: faviconStorageKey !== existing?.faviconStorageKey ? (existing?.faviconVersion ?? 0) + 1 : (typeof body.faviconVersion === "number" ? body.faviconVersion : existing?.faviconVersion ?? 0),
      defaultSocialImageStorageKey, defaultSocialImageUrl: assetUrl(body.defaultSocialImageUrl),
      defaultSocialImageAlt: text(body.defaultSocialImageAlt, 240),
      defaultSocialImageVersion: defaultSocialImageStorageKey !== existing?.defaultSocialImageStorageKey ? (existing?.defaultSocialImageVersion ?? 0) + 1 : (typeof body.defaultSocialImageVersion === "number" ? body.defaultSocialImageVersion : existing?.defaultSocialImageVersion ?? 0),
      locationLabel: text(body.locationLabel, 160, true)!, serviceArea: text(body.serviceArea, 160, true)!,
      serviceAreaDescription: text(body.serviceAreaDescription, 500), footerDescription: text(body.footerDescription, 500), availabilityMessage: text(body.availabilityMessage, 240),
      standardEyebrow: text(body.standardEyebrow, 120), standardHeadingLineOne: text(body.standardHeadingLineOne, 120), standardHeadingLineTwo: text(body.standardHeadingLineTwo, 120), standardBody: text(body.standardBody, 500),
      standardHeading: text(body.standardHeading, 160), standardHeadingAccent: text(body.standardHeadingAccent, 80), standardPrinciples: cards(body.standardPrinciples, 6),
      workEyebrow: text(body.workEyebrow, 120), workHeading: text(body.workHeading, 160), workHeadingLineOne: text(body.workHeadingLineOne, 120), workHeadingLineTwo: text(body.workHeadingLineTwo, 120), workHeadingAccent: text(body.workHeadingAccent, 80), workBody: text(body.workBody, 500), workButtonLabel: text(body.workButtonLabel, 80), workButtonDestination: assetUrl(body.workButtonDestination), featuredProjectEyebrow: text(body.featuredProjectEyebrow, 80), portfolioEyebrow: text(body.portfolioEyebrow, 120), portfolioHeading: text(body.portfolioHeading, 160), portfolioButtonLabel: text(body.portfolioButtonLabel, 80), portfolioButtonDestination: assetUrl(body.portfolioButtonDestination),
      approachEyebrow: text(body.approachEyebrow, 120), approachHeadingLineOne: text(body.approachHeadingLineOne, 120), approachHeadingLineTwo: text(body.approachHeadingLineTwo, 120), approachBody: text(body.approachBody, 500), conversionImageCaption: text(body.conversionImageCaption, 160),
      approachHeading: text(body.approachHeading, 160), approachHeadingAccent: text(body.approachHeadingAccent, 80), approachCards: cards(body.approachCards, 6), approachTagline: text(body.approachTagline, 120), approachButtonLabel: text(body.approachButtonLabel, 80), approachButtonDestination: assetUrl(body.approachButtonDestination),
      headerNavigation: navigation(body.headerNavigation), footerNavigation: navigation(body.footerNavigation),
      websiteUrl: url(body.websiteUrl), instagramUrl: url(body.instagramUrl, "instagram"), facebookUrl: url(body.facebookUrl, "facebook"), youtubeUrl: url(body.youtubeUrl, "youtube"), linkedinUrl: url(body.linkedinUrl, "linkedin"),
      brandVoice: text(body.brandVoice, 1000), brandAudience: text(body.brandAudience, 1000), brandWritingGuidance: text(body.brandWritingGuidance, 2000), defaultBlogAuthor: text(body.defaultBlogAuthor, 160),
      defaultSeoTitle: text(body.defaultSeoTitle, 160, true)!, defaultSeoDescription: text(body.defaultSeoDescription, 320, true)!,
    };
    const settings = await prisma.siteSettings.upsert({ where: { id: "default" }, create: { id: "default", workspaceId: session.workspaceId, ...data }, update: { ...data, workspaceId: session.workspaceId } });
    if (brandLogoStorageKey !== existing?.brandLogoStorageKey) await deleteContentImage(existing?.brandLogoStorageKey ?? null);
    if (brandMonogramStorageKey !== existing?.brandMonogramStorageKey) await deleteContentImage(existing?.brandMonogramStorageKey ?? null);
    if (faviconStorageKey !== existing?.faviconStorageKey) await deleteContentImage(existing?.faviconStorageKey ?? null);
    if (defaultSocialImageStorageKey !== existing?.defaultSocialImageStorageKey) await deleteContentImage(existing?.defaultSocialImageStorageKey ?? null);
    if (heliosStandardImageStorageKey !== existing?.heliosStandardImageStorageKey) await deleteContentImage(existing?.heliosStandardImageStorageKey ?? null);
    if (primaryConversionImageStorageKey !== existing?.primaryConversionImageStorageKey) await deleteContentImage(existing?.primaryConversionImageStorageKey ?? null);
    revalidatePath("/", "layout"); revalidatePath("/admin/settings"); revalidatePath("/admin/homepage");
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const messages: Record<string, string> = { INVALID_CARDS: "Homepage cards need a title and description.", INVALID_NAVIGATION: "Navigation items need a valid label and destination.", INVALID_TEXT: "Complete every required field and stay within the displayed limits.", INVALID_URL: "One or more links are not valid web addresses.", INVALID_PHONE: "Enter the phone number in international format, such as +19706825533.", INVALID_EMAIL: "Enter a valid email address.", INVALID_LOGO_KEY: "The brand logo storage location is invalid.", INVALID_MONOGRAM_KEY: "The brand monogram storage location is invalid.", INVALID_FAVICON_KEY: "The favicon storage location is invalid.", INVALID_SOCIAL_IMAGE_KEY: "The default social share image storage location is invalid.", INVALID_HOMEPAGE_IMAGE_KEY: "The homepage image storage location is invalid." };
    if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 });
    console.error("Unable to update site settings:", error); return NextResponse.json({ success: false, error: "Global site settings could not be saved." }, { status: 500 });
  }
}
