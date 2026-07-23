import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type LocationBody = Record<string, unknown>;

const LIMITS = {
  city: 100,
  state: 100,
  county: 140,
  slug: 120,
  seoTitle: 160,
  seoDescription: 320,
  heroLead: 320,
  introduction: 1400,
  marketTitle: 240,
  marketCopy: 1400,
  serviceArea: 500,
  detail: 240,
};

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
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
    .map((item) => text(item, LIMITS.detail))
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
    published: true,
    displayOrder: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

async function uniqueSlug(requested: string, locationId?: string) {
  const base = slugify(requested) || "location";
  let candidate = base;
  let suffix = 2;
  while (
    await prisma.locationPage.findFirst({
      where: { slug: candidate, ...(locationId ? { id: { not: locationId } } : {}) },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

function starterContent(body: LocationBody) {
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
    seoTitle: `${city} Real Estate Photography & Video | Helios`,
    seoDescription: `Professional real estate photography, cinematic video, drone media, and social content for ${city}, ${state} listings and real estate professionals.`,
    heroLead: `Intentional real estate photography and cinematic media for listings across ${city}.`,
    introduction: `${city} properties deserve marketing shaped around more than a checklist. Helios combines architectural photography, cinematic movement, aerial perspective, and social-first content to help agents present each listing with clarity, emotion, and a stronger sense of place.`,
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
    city: text(body.city, LIMITS.city),
    state: text(body.state, LIMITS.state) || "Colorado",
    county: text(body.county, LIMITS.county),
    seoTitle: text(body.seoTitle, LIMITS.seoTitle),
    seoDescription: text(body.seoDescription, LIMITS.seoDescription),
    heroLead: text(body.heroLead, LIMITS.heroLead),
    introduction: text(body.introduction, LIMITS.introduction),
    marketTitle: text(body.marketTitle, LIMITS.marketTitle),
    marketCopy: text(body.marketCopy, LIMITS.marketCopy),
    localDetails,
    serviceArea: text(body.serviceArea, LIMITS.serviceArea),
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
  try {
    const body = (await request.json()) as LocationBody;
    const generated = body.action === "generate" ? starterContent(body) : payload(body);
    const data = payload(generated);
    if (!valid(data)) {
      return NextResponse.json({ success: false, error: "City, county, page copy, local details, and service area are required." }, { status: 400 });
    }
    const slug = await uniqueSlug(text(body.slug, LIMITS.slug) || data.city);
    const order = await prisma.locationPage.aggregate({ _max: { displayOrder: true } });
    const location = await prisma.locationPage.create({
      data: {
        ...data,
        slug,
        localDetails: data.localDetails,
        published: false,
        displayOrder: (order._max.displayOrder ?? -1) + 1,
      },
      select: selectLocation(),
    });
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "LOCATION_PAGE_CREATED",
      entityType: "LocationPage",
      entityId: location.id,
      summary: `${location.city} local page created as a draft.`,
    });
    revalidateLocations([slug]);
    return NextResponse.json({ success: true, location }, { status: 201 });
  } catch (error) {
    console.error("Unable to create location page:", error);
    return NextResponse.json({ success: false, error: "The local page could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    const body = (await request.json()) as LocationBody;
    const locationId = text(body.locationId, 100);
    const action = text(body.action, 40);
    if (!locationId) return NextResponse.json({ success: false, error: "Location page ID required." }, { status: 400 });
    const existing = await prisma.locationPage.findUnique({ where: { id: locationId }, select: { slug: true, city: true } });
    if (!existing) return NextResponse.json({ success: false, error: "Local page not found." }, { status: 404 });

    if (action === "reorder") {
      const direction = body.direction === "up" ? -1 : body.direction === "down" ? 1 : 0;
      if (!direction) return NextResponse.json({ success: false, error: "Valid reorder direction required." }, { status: 400 });
      const ordered = await prisma.locationPage.findMany({ orderBy: [{ displayOrder: "asc" }, { city: "asc" }], select: { id: true } });
      const index = ordered.findIndex((item) => item.id === locationId);
      const target = index + direction;
      if (index >= 0 && target >= 0 && target < ordered.length) {
        await prisma.$transaction([
          prisma.locationPage.update({ where: { id: ordered[index].id }, data: { displayOrder: target } }),
          prisma.locationPage.update({ where: { id: ordered[target].id }, data: { displayOrder: index } }),
        ]);
      }
      revalidateLocations();
      return NextResponse.json({ success: true });
    }

    if (action === "publish") {
      const location = await prisma.locationPage.update({
        where: { id: locationId },
        data: { published: Boolean(body.published) },
        select: selectLocation(),
      });
      await recordAuditEvent({
        actorId: session.userId,
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
    const slug = await uniqueSlug(text(body.slug, LIMITS.slug) || data.city, locationId);
    const location = await prisma.locationPage.update({
      where: { id: locationId },
      data: { ...data, slug, localDetails: data.localDetails },
      select: selectLocation(),
    });
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "LOCATION_PAGE_UPDATED",
      entityType: "LocationPage",
      entityId: location.id,
      summary: `${location.city} local page updated.`,
    });
    revalidateLocations([existing.slug, slug]);
    return NextResponse.json({ success: true, location });
  } catch (error) {
    console.error("Unable to update location page:", error);
    return NextResponse.json({ success: false, error: "The local page could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    const locationId = new URL(request.url).searchParams.get("locationId")?.trim();
    if (!locationId) return NextResponse.json({ success: false, error: "Location page ID required." }, { status: 400 });
    const location = await prisma.locationPage.delete({ where: { id: locationId }, select: { id: true, city: true, slug: true } });
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "LOCATION_PAGE_DELETED",
      entityType: "LocationPage",
      entityId: location.id,
      summary: `${location.city} local page deleted.`,
    });
    revalidateLocations([location.slug]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete location page:", error);
    return NextResponse.json({ success: false, error: "The local page could not be deleted." }, { status: 500 });
  }
}
