import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { Prisma } from "@/app/generated/prisma/client";
import type { AboutListItem } from "@/lib/about-page";
import { deleteContentImage, verifyContentImage } from "@/lib/content-image-storage";
import { prisma } from "@/lib/prisma";

const imageFields = [
  { storage: "heroImageStorageKey", url: "heroImageUrl", alt: "heroImageAlt" },
  { storage: "galleryOneStorageKey", url: "galleryOneUrl", alt: "galleryOneAlt" },
  { storage: "galleryTwoStorageKey", url: "galleryTwoUrl", alt: "galleryTwoAlt" },
  { storage: "galleryThreeStorageKey", url: "galleryThreeUrl", alt: "galleryThreeAlt" },
] as const;

function requiredText(value: unknown, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > max) throw new Error("INVALID_TEXT");
  return result;
}

function optionalKey(value: unknown) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) return null;
  if (!result.startsWith("site/about/")) throw new Error("INVALID_IMAGE");
  return result;
}

function imageUrl(value: unknown) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) return null;
  if (result.startsWith("/") && !result.startsWith("//")) return result;
  const parsed = new URL(result);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("INVALID_IMAGE");
  return parsed.toString();
}

function items(value: unknown): AboutListItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw new Error("INVALID_ITEMS");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("INVALID_ITEMS");
    const record = item as Record<string, unknown>;
    return {
      number: requiredText(record.number || String(index + 1).padStart(2, "0"), 12),
      title: requiredText(record.title, 120),
      copy: requiredText(record.copy, 800),
    };
  });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const existing = await prisma.aboutPageContent.findUnique({ where: { id: "default" } });
    const images = Object.fromEntries(imageFields.flatMap((field) => [
      [field.storage, optionalKey(body[field.storage])],
      [field.url, imageUrl(body[field.url])],
      [field.alt, requiredText(body[field.alt], 240)],
    ])) as Record<string, string | null>;

    for (const field of imageFields) {
      const storageKey = images[field.storage] as string | null;
      const previousKey = existing?.[field.storage] as string | null | undefined;
      if (storageKey !== previousKey) await verifyContentImage(storageKey);
    }

    const data = {
      heroEyebrow: requiredText(body.heroEyebrow, 120),
      heroHeadline: requiredText(body.heroHeadline, 240),
      heroBody: requiredText(body.heroBody, 1200),
      heroImageStorageKey: images.heroImageStorageKey,
      heroImageUrl: images.heroImageUrl,
      heroImageAlt: images.heroImageAlt as string,
      storyEyebrow: requiredText(body.storyEyebrow, 120),
      storyIntro: requiredText(body.storyIntro, 1200),
      storyHeadline: requiredText(body.storyHeadline, 500),
      storyBodyLeft: requiredText(body.storyBodyLeft, 1600),
      storyBodyRight: requiredText(body.storyBodyRight, 1600),
      principlesEyebrow: requiredText(body.principlesEyebrow, 120),
      principlesHeadline: requiredText(body.principlesHeadline, 240),
      principlesIntro: requiredText(body.principlesIntro, 800),
      principles: items(body.principles) as unknown as Prisma.InputJsonValue,
      galleryOneStorageKey: images.galleryOneStorageKey,
      galleryOneUrl: images.galleryOneUrl,
      galleryOneAlt: images.galleryOneAlt as string,
      galleryTwoStorageKey: images.galleryTwoStorageKey,
      galleryTwoUrl: images.galleryTwoUrl,
      galleryTwoAlt: images.galleryTwoAlt as string,
      galleryThreeStorageKey: images.galleryThreeStorageKey,
      galleryThreeUrl: images.galleryThreeUrl,
      galleryThreeAlt: images.galleryThreeAlt as string,
      processEyebrow: requiredText(body.processEyebrow, 120),
      processHeadline: requiredText(body.processHeadline, 320),
      process: items(body.process) as unknown as Prisma.InputJsonValue,
    };

    const content = await prisma.aboutPageContent.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });

    for (const field of imageFields) {
      const storageKey = images[field.storage] as string | null;
      const previousKey = existing?.[field.storage] as string | null | undefined;
      if (storageKey !== previousKey) await deleteContentImage(previousKey ?? null);
    }

    revalidatePath("/about");
    revalidatePath("/admin/about");
    return NextResponse.json({ success: true, content });
  } catch (error) {
    if (error instanceof Error && ["INVALID_TEXT", "INVALID_ITEMS", "INVALID_IMAGE"].includes(error.message)) {
      return NextResponse.json({ success: false, error: "Complete the About fields with valid text and images." }, { status: 400 });
    }
    console.error("Unable to save About page:", error);
    return NextResponse.json({ success: false, error: "The About page could not be saved." }, { status: 500 });
  }
}
