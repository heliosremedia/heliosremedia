import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { Prisma } from "@/app/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth/session";
import { verifyContentImage } from "@/lib/content-image-storage";
import { defaultPhotoComparisonContent, type PhotoComparisonContent } from "@/lib/photo-comparison";
import { prisma } from "@/lib/prisma";

function requiredText(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error("INVALID_TEXT");
  return text;
}

function optionalKey(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (!text.startsWith("site/photo-comparison/")) throw new Error("INVALID_IMAGE");
  return text;
}

function imageUrl(value: unknown) {
  const text = requiredText(value, 1500);
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  const parsed = new URL(text);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("INVALID_IMAGE");
  return parsed.toString();
}

function editorialStyle(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > 60) throw new Error("INVALID_TEXT");
  return text || null;
}

function destination(value: unknown) {
  const text = requiredText(value, 500);
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  const parsed = new URL(text);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("INVALID_TEXT");
  return parsed.toString();
}

function parseContent(value: unknown): PhotoComparisonContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_TEXT");
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(defaultPhotoComparisonContent).map(([key, fallback]) => {
    if (Array.isArray(fallback)) {
      const items = Array.isArray(record[key]) ? record[key].map((item) => requiredText(item, 180)).slice(0, 12) : [];
      if (!items.length) throw new Error("INVALID_TEXT");
      return [key, items];
    }
    return [key, key.includes("Destination") ? destination(record[key]) : requiredText(record[key], 1800)];
  })) as PhotoComparisonContent;
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = await request.json() as Record<string, unknown>;
    const content = parseContent(body.content);
    const pairs = Array.isArray(body.pairs) ? body.pairs : [];
    if (pairs.length < 1 || pairs.length > 12) throw new Error("INVALID_PAIRS");
    const pairData = pairs.map((item, position) => {
      if (!item || typeof item !== "object") throw new Error("INVALID_PAIRS");
      const pair = item as Record<string, unknown>;
      return {
        label: requiredText(pair.label, 120), editorialStyle: editorialStyle(pair.editorialStyle), alt: requiredText(pair.alt, 240), caption: requiredText(pair.caption, 500), active: pair.active !== false, position,
        standardImageStorageKey: optionalKey(pair.standardImageStorageKey), standardImageUrl: imageUrl(pair.standardImageUrl),
        editorialImageStorageKey: optionalKey(pair.editorialImageStorageKey), editorialImageUrl: imageUrl(pair.editorialImageUrl),
      };
    });
    const detailImageStorageKey = optionalKey(body.detailImageStorageKey);
    const detailImageUrl = imageUrl(body.detailImageUrl);
    const detailImageAlt = requiredText(body.detailImageAlt, 240);

    await Promise.all([
      detailImageStorageKey,
      ...pairData.flatMap((pair) => [
        pair.standardImageStorageKey,
        pair.editorialImageStorageKey,
      ]),
    ].map((key) => verifyContentImage(key)));

    const page = await prisma.$transaction(async (tx) => {
      const saved = await tx.photoComparisonPage.upsert({ where: { workspaceId: session.workspaceId }, create: { workspaceId: session.workspaceId, active: body.active !== false, content: content as unknown as Prisma.InputJsonValue, detailImageStorageKey, detailImageUrl, detailImageAlt }, update: { active: body.active !== false, content: content as unknown as Prisma.InputJsonValue, detailImageStorageKey, detailImageUrl, detailImageAlt } });
      await tx.photoComparisonPair.deleteMany({ where: { pageId: saved.id } });
      await tx.photoComparisonPair.createMany({ data: pairData.map((pair) => ({ ...pair, pageId: saved.id })) });
      return saved;
    });
    revalidatePath("/photo-finishes"); revalidatePath("/services"); revalidatePath("/portfolio"); revalidatePath("/admin/photo-comparison");
    return NextResponse.json({ success: true, page });
  } catch (error) {
    if (error instanceof Error && ["INVALID_TEXT", "INVALID_PAIRS", "INVALID_IMAGE"].includes(error.message)) return NextResponse.json({ success: false, error: "Complete every required field and image pair before publishing." }, { status: 400 });
    console.error("Unable to save photo comparison:", error);
    return NextResponse.json({ success: false, error: "The photo comparison could not be saved." }, { status: 500 });
  }
}
