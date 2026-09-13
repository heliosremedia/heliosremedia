import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { verifyRegisteredBrandImage } from "@/lib/workspace-brand-assets";
import { resolveLocationImage } from "@/lib/location-image-ownership";
import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { LOCATION_FIELD_LIMITS as LIMITS } from "@/lib/location-page-content";
import { prisma } from "@/lib/prisma";

type LocationBody = Record<string, unknown>;

async function requestBody(request: Request): Promise<LocationBody> {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_INPUT");
  return body as LocationBody;
}

function mutationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  if (["INVALID_INPUT", "INVALID_BRAND_IMAGE"].includes(message)) return NextResponse.json({ success: false, error: "Provide valid location information and an owned image." }, { status: 400 });
  if (message === "LOCATION_CHANGED" || (error && typeof error === "object" && "code" in error && ["P2025", "P2002"].includes(String(error.code)))) {
    return NextResponse.json({ success: false, error: "The location changed. Reload before trying again." }, { status: 409 });
  }
  return null;
}

function text(value: unknown, limit: number, strict = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (strict && result.length > limit) throw new Error("FIELD_TOO_LONG");
  return strict ? result : result.slice(0, limit);
}

function optionalText(value: unknown, limit: number) {
  const result = text(value, limit, true);
  return result || null;
}

function focal(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0.5;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function details(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item, LIMITS.detail, true))
    .filter(Boolean)
    .slice(0, 8);
}

function selectLocation() {
  return {
    id: true,
    slug: true,
    city: true,
    state: true,
    county: true,
    seoTitle: true,
    seoDescription: true,
    heroLead: true,
    introduction: true,
    marketTitle: true,
    marketCopy: true,
    localDetails: true,
    serviceArea: true,
    ctaHeadline: true,
    featureImageStorageKey: true,
    featureImageUrl: true,
    featureImageAlt: true,
    featureImageFocalX: true,
    featureImageFocalY: true,
    published: true,
    displayOrder: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

async function uniqueSlug(workspaceId: string, requested: string, locationId?: string) {
  const base = slugify(requested) || "location";
  let candidate = base;
  let suffix = 2;
  while (
    await prisma.locationPage.findFirst({
      where: { workspaceId, slug: candidate, ...(locationId ? { id: { not: locationId } } : {}) },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

function starterContent(body: LocationBody, businessName: string) {
  const city = text(body.city, LIMITS.city);
  const state = text(body.state, LIMITS.state) || "Colorado";
  const county = text(body.county, LIMITS.county) || "Northern Colorado";
  const nearby = text(body.nearbyCommunities, 300);
  const nearbyList = nearby
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
  const area = [city, ...nearbyList].filter(Boolean).join(", ");

  return {
    city,
    state,
    county,
    seoTitle: `${city} Real Estate Photography & Video | ${businessName}`,
    seoDescription: `Professional real estate photography, cinematic video, drone media, and social content for ${city}, ${state} listings and real estate professionals.`,
    heroLead: `Intentional real estate photography and cinematic media for listings across ${city}.`,
    introduction: `${city} properties deserve marketing shaped around more than a checklist. ${businessName} combines architectural photography, cinematic movement, aerial perspective, and social-first content to help agents present each listing with clarity, emotion, and a stronger sense of place.`,
    marketTitle: `${city} listings deserve a deliberate visual story.`,
    marketCopy: `From the first exterior frame through the final film edit, every deliverable is planned around the property, its audience, and the way buyers experience the surrounding ${county} market. The result is a polished collection built for the MLS, social media, listing presentations, and the agent’s wider brand.`,
    localDetails: [
      `${city} residential listings and neighborhood stories`,
      "New construction and builder marketing",
      "Luxury, acreage, and distinctive properties",
      "Agent branding and community-focused content",
    ],
    serviceArea: area
      ? `Serving ${area}, and nearby ${state} communities.`
      : `Serving ${city} and surrounding ${state} communities.`,
  };
}

function payload(body: LocationBody) {
  const localDetails = details(body.localDetails);
  return {
    city: text(body.city, LIMITS.city, true),
    state: text(body.state, LIMITS.state, true) || "Colorado",
    county: text(body.county, LIMITS.county, true),
    seoTitle: text(body.seoTitle, LIMITS.seoTitle, true),
    seoDescription: text(body.seoDescription, LIMITS.seoDescription, true),
    heroLead: text(body.heroLead, LIMITS.heroLead, true),
    introduction: text(body.introduction, LIMITS.introduction, true),
    marketTitle: text(body.marketTitle, LIMITS.marketTitle, true),
    marketCopy: text(body.marketCopy, LIMITS.marketCopy, true),
    localDetails,
    serviceArea: text(body.serviceArea, LIMITS.serviceArea, true),
    ctaHeadline: optionalText(body.ctaHeadline, LIMITS.ctaHeadline),
    featureImageStorageKey: optionalText(body.featureImageStorageKey, 500),
    featureImageUrl: optionalText(body.featureImageUrl, 2000),
    featureImageAlt: typeof body.featureImageAlt === "string" ? text(body.featureImageAlt, LIMITS.featureImageAlt, true) : null,
    featureImageFocalX: focal(body.featureImageFocalX),
    featureImageFocalY: focal(body.featureImageFocalY),
  };
}

function valid(data: ReturnType<typeof payload>) {
  return (
    data.city &&
    data.state &&
    data.county &&
    data.seoTitle &&
    data.seoDescription &&
    data.heroLead &&
    data.introduction &&
    data.marketTitle &&
    data.marketCopy &&
    data.localDetails.length > 0 &&
    data.serviceArea
  );
}

function revalidateLocations(slugs: string[] = []) {
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/locations");
  slugs.forEach((slug) => revalidatePath(`/locations/${slug}`));
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  try {
    const body = await requestBody(request);
    const settings = await prisma.siteSettings.findFirst({ where: { workspaceId: session.workspaceId }, select: { businessName: true } });
    const generated = body.action === "generate" ? starterContent(body, settings?.businessName || "Your company") : payload(body);
    const data = payload(generated);
    if (!valid(data)) {
      return NextResponse.json({ success: false, error: "City, county, page copy, local details, and service area are required." }, { status: 400 });
    }
    const image = resolveLocationImage(session.workspaceId, null, { key: data.featureImageStorageKey, url: data.featureImageUrl }, null, getPublicAssetUrl);
    data.featureImageStorageKey = image.key; data.featureImageUrl = image.url;
    await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "locations", key: image.key });
    const slug = await uniqueSlug(session.workspaceId, text(body.slug, LIMITS.slug, true) || data.city);
    const order = await prisma.locationPage.aggregate({ where: { workspaceId: session.workspaceId }, _max: { displayOrder: true } });
    const location = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, session);
      return tx.locationPage.create({
        data: {
          ...data,
          workspaceId: session.workspaceId,
          slug,
          localDetails: data.localDetails,
          published: false,
          displayOrder: (order._max.displayOrder ?? -1) + 1,
        },
        select: selectLocation(),
      });
    });
    await recordAuditEvent({
      workspaceId: session.workspaceId, actorId: session.userId,
      actorEmail: session.email,
      action: "LOCATION_PAGE_CREATED",
      entityType: "LocationPage",
      entityId: location.id,
      summary: `${location.city} local page created as a draft.`,
    });
    revalidateLocations([slug]);
    return NextResponse.json({ success: true, location }, { status: 201 });
  } catch (error) {
    const failure = mutationError(error); if (failure) return failure;
    if (error instanceof Error && error.message === "FIELD_TOO_LONG") {
      return NextResponse.json({ success: false, error: "One or more fields exceed their character limit." }, { status: 400 });
    }
    console.error("Unable to create location page", { category: "request_failed" });
    return NextResponse.json({ success: false, error: "The local page could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  try {
    const body = await requestBody(request);
    const locationId = text(body.locationId, 100);
    const action = text(body.action, 40);
    if (!locationId) return NextResponse.json({ success: false, error: "Location page ID required." }, { status: 400 });
    const existing = await prisma.locationPage.findFirst({ where: { id: locationId, workspaceId: session.workspaceId }, select: { slug: true, city: true, updatedAt: true, featureImageStorageKey: true, featureImageUrl: true } });
    if (!existing) return NextResponse.json({ success: false, error: "Local page not found." }, { status: 404 });
    const where = { id: locationId, workspaceId: session.workspaceId, updatedAt: existing.updatedAt };

    if (action === "reorder") {
      const direction = body.direction === "up" ? -1 : body.direction === "down" ? 1 : 0;
      if (!direction) return NextResponse.json({ success: false, error: "Valid reorder direction required." }, { status: 400 });
      await prisma.$transaction(async tx => {
        await requireLockedWorkspaceEditor(tx, session);
        if (!await tx.locationPage.findFirst({ where, select: { id: true } })) throw new Error("LOCATION_CHANGED");
        const ordered = await tx.locationPage.findMany({ where: { workspaceId: session.workspaceId }, orderBy: [{ displayOrder: "asc" }, { city: "asc" }], select: { id: true, updatedAt: true } });
        const index = ordered.findIndex((item) => item.id === locationId);
        const target = index + direction;
        if (index >= 0 && target >= 0 && target < ordered.length) {
          await tx.locationPage.update({ where: { id: ordered[index].id, workspaceId: session.workspaceId, updatedAt: ordered[index].updatedAt }, data: { displayOrder: target } });
          await tx.locationPage.update({ where: { id: ordered[target].id, workspaceId: session.workspaceId, updatedAt: ordered[target].updatedAt }, data: { displayOrder: index } });
        }
      });
      revalidateLocations();
      return NextResponse.json({ success: true });
    }

    if (action === "publish") {
      if (typeof body.published !== "boolean") throw new Error("INVALID_INPUT");
      if (body.published) {
        const current = { key: existing.featureImageStorageKey ?? null, url: existing.featureImageUrl ?? null };
        const image = resolveLocationImage(session.workspaceId, locationId, current, current, getPublicAssetUrl);
        await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "locations", key: image.key, existingKey: existing.featureImageStorageKey });
      }
      const location = await prisma.$transaction(async tx => {
        await requireLockedWorkspaceEditor(tx, session);
        return tx.locationPage.update({
          where,
          data: { published: body.published === true },
          select: selectLocation(),
        });
      });
      await recordAuditEvent({
        workspaceId: session.workspaceId, actorId: session.userId,
        actorEmail: session.email,
        action: location.published ? "LOCATION_PAGE_PUBLISHED" : "LOCATION_PAGE_UNPUBLISHED",
        entityType: "LocationPage",
        entityId: location.id,
        summary: `${location.city} local page ${location.published ? "published" : "unpublished"}.`,
      });
      revalidateLocations([existing.slug]);
      return NextResponse.json({ success: true, location });
    }

    const data = payload(body);
    if (!valid(data)) return NextResponse.json({ success: false, error: "Complete every required page field before saving." }, { status: 400 });
    const image = resolveLocationImage(session.workspaceId, locationId, { key: data.featureImageStorageKey, url: data.featureImageUrl },
      { key: existing.featureImageStorageKey, url: existing.featureImageUrl }, getPublicAssetUrl);
    data.featureImageStorageKey = image.key; data.featureImageUrl = image.url;
    await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "locations", key: image.key, existingKey: existing.featureImageStorageKey });
    const slug = await uniqueSlug(session.workspaceId, text(body.slug, LIMITS.slug, true) || data.city, locationId);
    const location = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, session);
      return tx.locationPage.update({
        where,
        data: { ...data, slug, localDetails: data.localDetails },
        select: selectLocation(),
      });
    });
    // Retain old/shared images until usage and retention evidence permits cleanup.
    await recordAuditEvent({
      workspaceId: session.workspaceId, actorId: session.userId,
      actorEmail: session.email,
      action: "LOCATION_PAGE_UPDATED",
      entityType: "LocationPage",
      entityId: location.id,
      summary: `${location.city} local page updated.`,
    });
    revalidateLocations([existing.slug, slug]);
    return NextResponse.json({ success: true, location });
  } catch (error) {
    const failure = mutationError(error); if (failure) return failure;
    if (error instanceof Error && error.message === "FIELD_TOO_LONG") {
      return NextResponse.json({ success: false, error: "One or more fields exceed their character limit." }, { status: 400 });
    }
    console.error("Unable to update location page", { category: "request_failed" });
    return NextResponse.json({ success: false, error: "The local page could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  try {
    const locationId = new URL(request.url).searchParams.get("locationId")?.trim();
    if (!locationId) return NextResponse.json({ success: false, error: "Location page ID required." }, { status: 400 });
    const existing = await prisma.locationPage.findFirst({ where: { id: locationId, workspaceId: session.workspaceId }, select: { id: true, updatedAt: true } });
    if (!existing) return NextResponse.json({ success: false, error: "Local page not found." }, { status: 404 });
    const location = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, session);
      return tx.locationPage.delete({ where: { id: locationId, workspaceId: session.workspaceId, updatedAt: existing.updatedAt }, select: { id: true, city: true, slug: true } });
    });
    // Deleting a page never authorizes deletion of its stored media object.
    await recordAuditEvent({
      workspaceId: session.workspaceId, actorId: session.userId,
      actorEmail: session.email,
      action: "LOCATION_PAGE_DELETED",
      entityType: "LocationPage",
      entityId: location.id,
      summary: `${location.city} local page deleted.`,
    });
    revalidateLocations([location.slug]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const failure = mutationError(error); if (failure) return failure;
    console.error("Unable to delete location page", { category: "request_failed" });
    return NextResponse.json({ success: false, error: "The local page could not be deleted." }, { status: 500 });
  }
}
