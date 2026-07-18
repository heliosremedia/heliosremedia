import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deleteContentImage, verifyContentImage } from "@/lib/content-image-storage";
import { prisma } from "@/lib/prisma";
import { TESTIMONIAL_CHARACTER_LIMIT } from "@/lib/testimonials";

const testimonialSelect = {
  id: true,
  agentName: true,
  jobTitle: true,
  brokerage: true,
  testimonial: true,
  photoStorageKey: true,
  photoUrl: true,
  photoAlt: true,
  sourceUrl: true,
  focalX: true,
  focalY: true,
  rating: true,
  displayOrder: true,
  published: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
} as const;

function optionalText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maxLength) throw new Error("TEXT_TOO_LONG");
  return text || null;
}

function validateUrl(value: unknown) {
  const text = optionalText(value, 1000);
  if (!text) return null;
  const url = new URL(text);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("INVALID_URL");
  return url.toString();
}

function validateBody(body: Record<string, unknown>) {
  const agentName = typeof body.agentName === "string" ? body.agentName.trim() : "";
  const testimonial = typeof body.testimonial === "string" ? body.testimonial.trim() : "";
  if (!agentName || agentName.length > 120) throw new Error("INVALID_NAME");
  if (!testimonial || testimonial.length > TESTIMONIAL_CHARACTER_LIMIT) throw new Error("INVALID_TESTIMONIAL");
  const rating = typeof body.rating === "number" ? Math.round(body.rating) : 5;
  if (rating < 1 || rating > 5) throw new Error("INVALID_RATING");
  const photoStorageKey = optionalText(body.photoStorageKey, 1000);
  if (photoStorageKey && !photoStorageKey.startsWith("testimonials/")) throw new Error("INVALID_PHOTO_KEY");

  return {
    agentName,
    testimonial,
    jobTitle: optionalText(body.jobTitle, 120),
    brokerage: optionalText(body.brokerage, 160),
    photoStorageKey,
    photoUrl: optionalText(body.photoUrl, 1500),
    photoAlt: optionalText(body.photoAlt, 240),
    sourceUrl: validateUrl(body.sourceUrl),
    focalX: typeof body.focalX === "number" ? Math.min(1, Math.max(0, body.focalX)) : 0.5,
    focalY: typeof body.focalY === "number" ? Math.min(1, Math.max(0, body.focalY)) : 0.2,
    rating,
  };
}

function refreshTestimonials() {
  revalidatePath("/");
  revalidatePath("/admin/testimonials");
}

function validationResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  const messages: Record<string, string> = {
    INVALID_NAME: "An agent name between 1 and 120 characters is required.",
    INVALID_TESTIMONIAL: `A testimonial between 1 and ${TESTIMONIAL_CHARACTER_LIMIT} characters is required.`,
    INVALID_RATING: "The rating must be between one and five stars.",
    INVALID_URL: "The review source must be a valid web address.",
    INVALID_PHOTO_KEY: "The testimonial photo location is invalid.",
    TEXT_TOO_LONG: "One or more fields exceed the allowed length.",
  };
  return messages[error.message] ?? null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = validateBody(body);
    await verifyContentImage(data.photoStorageKey);
    const order = await prisma.testimonial.aggregate({ _max: { displayOrder: true } });
    const testimonial = await prisma.testimonial.create({
      data: { ...data, displayOrder: (order._max.displayOrder ?? -1) + 1, published: body.published === true, featured: body.featured === true },
      select: testimonialSelect,
    });
    refreshTestimonials();
    return NextResponse.json({ success: true, testimonial }, { status: 201 });
  } catch (error) {
    const message = validationResponse(error);
    if (message) return NextResponse.json({ success: false, error: message }, { status: 400 });
    console.error("Unable to create testimonial:", error);
    return NextResponse.json({ success: false, error: "The testimonial could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "reorder") {
      const ids = Array.isArray(body.testimonialIds) ? body.testimonialIds.filter((id): id is string => typeof id === "string") : [];
      const current = await prisma.testimonial.findMany({ select: { id: true } });
      if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) {
        return NextResponse.json({ success: false, error: "The testimonial list changed before the order was saved. Refresh and try again." }, { status: 409 });
      }
      await prisma.$transaction(ids.map((id, displayOrder) => prisma.testimonial.update({ where: { id }, data: { displayOrder } })));
      refreshTestimonials();
      return NextResponse.json({ success: true, testimonialIds: ids });
    }

    const testimonialId = typeof body.testimonialId === "string" ? body.testimonialId : "";
    if (!testimonialId) return NextResponse.json({ success: false, error: "A testimonial ID is required." }, { status: 400 });

    if (action === "set-status") {
      const update: { published?: boolean; featured?: boolean } = {};
      if (typeof body.published === "boolean") update.published = body.published;
      if (typeof body.featured === "boolean") update.featured = body.featured;
      if (Object.keys(update).length === 0) return NextResponse.json({ success: false, error: "A publishing or featured status is required." }, { status: 400 });
      const testimonial = await prisma.testimonial.update({ where: { id: testimonialId }, data: update, select: testimonialSelect });
      refreshTestimonials();
      return NextResponse.json({ success: true, testimonial });
    }

    if (action === "update") {
      const existing = await prisma.testimonial.findUnique({ where: { id: testimonialId }, select: { photoStorageKey: true } });
      if (!existing) return NextResponse.json({ success: false, error: "The testimonial was not found." }, { status: 404 });
      const data = validateBody(body);
      if (data.photoStorageKey !== existing.photoStorageKey) await verifyContentImage(data.photoStorageKey);
      const testimonial = await prisma.testimonial.update({
        where: { id: testimonialId },
        data: {
          ...data,
          ...(typeof body.published === "boolean" ? { published: body.published } : {}),
          ...(typeof body.featured === "boolean" ? { featured: body.featured } : {}),
        },
        select: testimonialSelect,
      });
      const storageCleanupPending = data.photoStorageKey !== existing.photoStorageKey ? await deleteContentImage(existing.photoStorageKey) : false;
      refreshTestimonials();
      return NextResponse.json({ success: true, testimonial, storageCleanupPending });
    }

    return NextResponse.json({ success: false, error: "Unsupported testimonial action." }, { status: 400 });
  } catch (error) {
    const message = validationResponse(error);
    if (message) return NextResponse.json({ success: false, error: message }, { status: 400 });
    console.error("Unable to update testimonial:", error);
    return NextResponse.json({ success: false, error: "The testimonial could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const testimonialId = new URL(request.url).searchParams.get("testimonialId")?.trim();
    if (!testimonialId) return NextResponse.json({ success: false, error: "A testimonial ID is required." }, { status: 400 });
    const testimonial = await prisma.testimonial.delete({ where: { id: testimonialId }, select: { id: true, photoStorageKey: true } });
    const storageCleanupPending = await deleteContentImage(testimonial.photoStorageKey);
    refreshTestimonials();
    return NextResponse.json({ success: true, deletedTestimonialId: testimonial.id, storageCleanupPending });
  } catch (error) {
    console.error("Unable to delete testimonial:", error);
    return NextResponse.json({ success: false, error: "The testimonial could not be deleted." }, { status: 500 });
  }
}
