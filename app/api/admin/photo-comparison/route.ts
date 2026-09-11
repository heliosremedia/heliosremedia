import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { Prisma } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { verifyRegisteredBrandImage } from "@/lib/workspace-brand-assets";
import { resolvePhotoComparisonImage } from "@/lib/photo-comparison-storage";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { defaultPhotoComparisonContent, getPhotoComparisonPage, type PhotoComparisonContent } from "@/lib/photo-comparison";
import { prisma } from "@/lib/prisma";

function requiredText(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error("INVALID_TEXT");
  return text;
}

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > 1500) throw new Error("INVALID_IMAGE");
  return text || null;
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
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const workspaceId = session.workspaceId;
    const body = await request.json() as Record<string, unknown>;
    const existingPage = await getPhotoComparisonPage(session.workspaceId);
    if (body.updatedAt !== undefined && String(body.updatedAt ?? "") !== (existingPage.updatedAt?.toISOString() ?? "")) throw new Error("COMPARISON_CONFLICT");
    const content = parseContent(body.content);
    async function image(keyValue: unknown, urlValue: unknown, existing: { key: string | null; url: string | null } | null) {
      const resolved = resolvePhotoComparisonImage(workspaceId, { key: optionalText(keyValue), url: optionalText(urlValue) }, existing, getPublicAssetUrl);
      await verifyRegisteredBrandImage({ workspaceId: workspaceId, kind: "photo-comparison", key: resolved.key, existingKey: existing?.key });
      return resolved;
    }
    const pairs = Array.isArray(body.pairs) ? body.pairs : [];
    if (pairs.length < 1 || pairs.length > 12) throw new Error("INVALID_PAIRS");
    const pairData = await Promise.all(pairs.map(async (item, position) => {
      if (!item || typeof item !== "object") throw new Error("INVALID_PAIRS");
      const pair = item as Record<string, unknown>;
      const previous = existingPage.pairs.find((value) => value.id === pair.id);
      const standard = await image(pair.standardImageStorageKey, pair.standardImageUrl, previous ? { key: previous.standardImageStorageKey, url: previous.standardImageUrl } : null);
      const editorial = await image(pair.editorialImageStorageKey, pair.editorialImageUrl, previous ? { key: previous.editorialImageStorageKey, url: previous.editorialImageUrl } : null);
      return {
        label: requiredText(pair.label, 120), editorialStyle: editorialStyle(pair.editorialStyle), alt: requiredText(pair.alt, 240), caption: requiredText(pair.caption, 500), active: pair.active !== false, position,
        standardImageStorageKey: standard.key, standardImageUrl: standard.url,
        editorialImageStorageKey: editorial.key, editorialImageUrl: editorial.url,
      };
    }));
    const detail = await image(body.detailImageStorageKey, body.detailImageUrl, { key: existingPage.detailImageStorageKey, url: existingPage.detailImageUrl });
    const detailImageStorageKey = detail.key;
    const detailImageUrl = detail.url;
    const detailImageAlt = requiredText(body.detailImageAlt, 240);

    const page = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${session.workspaceId} FOR UPDATE`;
      const current = await tx.photoComparisonPage.findUnique({ where: { workspaceId: session.workspaceId }, select: { updatedAt: true } });
      if ((current?.updatedAt.getTime() ?? null) !== (existingPage.updatedAt?.getTime() ?? null)) throw new Error("COMPARISON_CONFLICT");
      const saved = await tx.photoComparisonPage.upsert({ where: { workspaceId: session.workspaceId }, create: { workspaceId: session.workspaceId, active: body.active !== false, content: content as unknown as Prisma.InputJsonValue, detailImageStorageKey, detailImageUrl, detailImageAlt }, update: { active: body.active !== false, content: content as unknown as Prisma.InputJsonValue, detailImageStorageKey, detailImageUrl, detailImageAlt } });
      await tx.photoComparisonPair.deleteMany({ where: { pageId: saved.id } });
      await tx.photoComparisonPair.createMany({ data: pairData.map((pair) => ({ ...pair, pageId: saved.id })) });
      return tx.photoComparisonPage.findUniqueOrThrow({ where: { id: saved.id, workspaceId: session.workspaceId }, include: { pairs: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } } });
    });
    revalidatePath("/photo-finishes"); revalidatePath("/services"); revalidatePath("/portfolio"); revalidatePath("/admin/photo-comparison");
    return NextResponse.json({ success: true, page });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPARISON_CONFLICT") return NextResponse.json({ success: false, error: "The comparison page changed. Refresh and try again." }, { status: 409 });
    if (error instanceof Error && ["INVALID_TEXT", "INVALID_PAIRS", "INVALID_IMAGE", "INVALID_BRAND_IMAGE"].includes(error.message)) return NextResponse.json({ success: false, error: "Complete every required field and image pair before publishing." }, { status: 400 });
    console.error("Unable to save photo comparison:", error);
    return NextResponse.json({ success: false, error: "The photo comparison could not be saved." }, { status: 500 });
  }
}
