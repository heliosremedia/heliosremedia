import { resolveBrandImage } from "@/lib/workspace-brand-storage";
import { resolveSiteHeroUrl } from "@/lib/site-hero-ownership";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { getSiteSettingsWriteTarget } from "@/lib/site-settings-ownership";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyContentImage } from "@/lib/content-image-storage";
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
    const target = await getSiteSettingsWriteTarget(session.workspaceId);
    const body = (await request.json()) as Record<string, unknown>;
    if (body.updateScope === "homepage-navigation") {
      const items = navigation(body.navigation);
      const settings = await prisma.siteSettings.update({
        where: target.where,
        data: {
          headerNavigation: items,
          footerNavigation: items,
        },
      });
      revalidatePath("/", "layout");
      revalidatePath("/admin/homepage");
      return NextResponse.json({ success: true, settings });
    }
    if (body.updateScope === "homepage-structure") {
      const settings = await prisma.siteSettings.update({
        where: target.where,
        data: {
          standardPrinciples: cards(body.standardPrinciples, 6),
          approachCards: cards(body.approachCards, 6),
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
    const brandMonogramStorageKey = text(body.brandMonogramStorageKey, 1000);
    const faviconStorageKey = text(body.faviconStorageKey, 1000);
    const defaultSocialImageStorageKey = text(body.defaultSocialImageStorageKey, 1000);
    const heliosStandardImageStorageKey = text(body.heliosStandardImageStorageKey, 1000);
    const primaryConversionImageStorageKey = text(body.primaryConversionImageStorageKey, 1000);
    const existing = await prisma.siteSettings.findUnique({ where: target.where });
    const brandLogo = resolveBrandImage(session.workspaceId, "site-brand", { key: brandLogoStorageKey, url: assetUrl(body.brandLogoUrl) }, existing ? { key: existing.brandLogoStorageKey, url: existing.brandLogoUrl } : null, getPublicAssetUrl);
    const brandMonogram = resolveBrandImage(session.workspaceId, "site-brand", { key: brandMonogramStorageKey, url: assetUrl(body.brandMonogramUrl) }, existing ? { key: existing.brandMonogramStorageKey, url: existing.brandMonogramUrl } : null, getPublicAssetUrl);
    const favicon = resolveBrandImage(session.workspaceId, "site-brand", { key: faviconStorageKey, url: assetUrl(body.faviconUrl) }, existing ? { key: existing.faviconStorageKey, url: existing.faviconUrl } : null, getPublicAssetUrl);
    const defaultSocialImage = resolveBrandImage(session.workspaceId, "site-brand", { key: defaultSocialImageStorageKey, url: assetUrl(body.defaultSocialImageUrl) }, existing ? { key: existing.defaultSocialImageStorageKey, url: existing.defaultSocialImageUrl } : null, getPublicAssetUrl);
    const heliosStandardImage = resolveBrandImage(session.workspaceId, "site-homepage", { key: heliosStandardImageStorageKey, url: assetUrl(body.heliosStandardImageUrl) }, existing ? { key: existing.heliosStandardImageStorageKey, url: existing.heliosStandardImageUrl } : null, getPublicAssetUrl);
    const primaryConversionImage = resolveBrandImage(session.workspaceId, "site-homepage", { key: primaryConversionImageStorageKey, url: assetUrl(body.primaryConversionImageUrl) }, existing ? { key: existing.primaryConversionImageStorageKey, url: existing.primaryConversionImageUrl } : null, getPublicAssetUrl);
    const heroVideo = resolveSiteHeroUrl(session.workspaceId, "video", assetUrl(body.heroVideoUrl), existing?.heroVideoUrl ?? null, getPublicAssetUrl);
    const heroPoster = resolveSiteHeroUrl(session.workspaceId, "poster", assetUrl(body.heroPosterUrl), existing?.heroPosterUrl ?? (!tenantContextEnabled() ? "/work/featured-estate.jpg" : null), getPublicAssetUrl);
    if (heroVideo.url !== existing?.heroVideoUrl) await verifyContentImage(heroVideo.key);
    if (heroPoster.url !== existing?.heroPosterUrl) await verifyContentImage(heroPoster.key);
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
      heroVideoUrl: heroVideo.url, heroPosterUrl: heroPoster.url, heroPosterAlt: text(body.heroPosterAlt, 240),
      heroEyebrow: text(body.heroEyebrow, 120), heroHeadlineLineOne: text(body.heroHeadlineLineOne, 120), heroHeadlineLineTwo: text(body.heroHeadlineLineTwo, 120), heroBody: text(body.heroBody, 420), heroPrimaryLabel: text(body.heroPrimaryLabel, 80), heroPrimaryDestination: assetUrl(body.heroPrimaryDestination), heroSecondaryLabel: text(body.heroSecondaryLabel, 80), heroSecondaryDestination: assetUrl(body.heroSecondaryDestination), availabilityEnabled: Boolean(body.availabilityEnabled), availabilityLabel: text(body.availabilityLabel, 80), availabilityStatus: ["AVAILABLE", "ADVISORY", "CRITICAL"].includes(String(body.availabilityStatus).toUpperCase()) ? String(body.availabilityStatus).toUpperCase() as "AVAILABLE" | "ADVISORY" | "CRITICAL" : "AVAILABLE",
      heliosStandardImageStorageKey, heliosStandardImageUrl: heliosStandardImage.url, heliosStandardImageAlt: text(body.heliosStandardImageAlt, 240),
      primaryConversionImageStorageKey, primaryConversionImageUrl: primaryConversionImage.url, primaryConversionImageAlt: text(body.primaryConversionImageAlt, 240),
      brandLogoStorageKey, brandLogoUrl: brandLogo.url, brandLogoAlt: text(body.brandLogoAlt, 240),
      brandMonogramStorageKey, brandMonogramUrl: brandMonogram.url,
      faviconStorageKey, faviconUrl: favicon.url, faviconVersion: faviconStorageKey !== existing?.faviconStorageKey ? (existing?.faviconVersion ?? 0) + 1 : (typeof body.faviconVersion === "number" ? body.faviconVersion : existing?.faviconVersion ?? 0),
      defaultSocialImageStorageKey, defaultSocialImageUrl: defaultSocialImage.url,
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
    const settings = await prisma.siteSettings.upsert({ where: target.where, create: { ...target.createIdentity, ...data }, update: data });
    revalidatePath("/", "layout"); revalidatePath("/admin/settings"); revalidatePath("/admin/homepage");
    const cleanupPending = [
      [existing?.brandLogoStorageKey, brandLogoStorageKey],
      [existing?.brandMonogramStorageKey, brandMonogramStorageKey],
      [existing?.faviconStorageKey, faviconStorageKey],
      [existing?.defaultSocialImageStorageKey, defaultSocialImageStorageKey],
      [existing?.heliosStandardImageStorageKey, heliosStandardImageStorageKey],
      [existing?.primaryConversionImageStorageKey, primaryConversionImageStorageKey],
    ].some(([previous, current]) => Boolean(previous && previous !== current));
    return NextResponse.json({ success: true, settings, cleanupPending });
  } catch (error) {
    const messages: Record<string, string> = { INVALID_BRAND_IMAGE: "Upload a company-owned image or keep the current image unchanged.", INVALID_HERO_MEDIA: "Upload company-owned hero media or keep the current media unchanged.", INVALID_CARDS: "Homepage cards need a title and description.", INVALID_NAVIGATION: "Navigation items need a valid label and destination.", INVALID_TEXT: "Complete every required field and stay within the displayed limits.", INVALID_URL: "One or more links are not valid web addresses.", INVALID_PHONE: "Enter the phone number in international format, such as +19706825533.", INVALID_EMAIL: "Enter a valid email address.", INVALID_LOGO_KEY: "The brand logo storage location is invalid.", INVALID_MONOGRAM_KEY: "The brand monogram storage location is invalid.", INVALID_FAVICON_KEY: "The favicon storage location is invalid.", INVALID_SOCIAL_IMAGE_KEY: "The default social share image storage location is invalid.", INVALID_HOMEPAGE_IMAGE_KEY: "The homepage image storage location is invalid." };
    if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 });
    console.error("Unable to update site settings:", error); return NextResponse.json({ success: false, error: "Global site settings could not be saved." }, { status: 500 });
  }
}
