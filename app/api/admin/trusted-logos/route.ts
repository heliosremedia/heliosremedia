import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { resolveBrandImage, brandImageCleanupPending } from "@/lib/workspace-brand-storage";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verifyRegisteredBrandImage, lockRegisteredBrandImage } from "@/lib/workspace-brand-assets";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";

const logoSelect = { id: true, organizationName: true, logoStorageKey: true, logoUrl: true, logoAlt: true, websiteUrl: true, monochrome: true, displayColor: true, displayOpacity: true, displayScale: true, displayOrder: true, published: true, createdAt: true, updatedAt: true } as const;

function optionalText(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) throw new Error("TEXT_TOO_LONG");
  return text || null;
}

function validUrl(value: unknown) {
  const text = optionalText(value, 1000);
  if (!text) return null;
  const url = new URL(text);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("INVALID_URL");
  return url.toString();
}

function validate(body: Record<string, unknown>, workspaceId: string, existing: { logoStorageKey: string | null; logoUrl: string | null } | null = null) {
  const organizationName = typeof body.organizationName === "string" ? body.organizationName.trim() : "";
  if (!organizationName || organizationName.length > 160) throw new Error("INVALID_NAME");
  const logoStorageKey = optionalText(body.logoStorageKey, 1000);
  const logoUrl = optionalText(body.logoUrl, 1500);
  if (!logoUrl) throw new Error("MISSING_LOGO");
  const displayColor = typeof body.displayColor === "string" ? body.displayColor.trim().toUpperCase() : "#D8D3CC";
  if (!/^#[0-9A-F]{6}$/.test(displayColor)) throw new Error("INVALID_COLOR");
  const displayOpacity = typeof body.displayOpacity === "number" ? body.displayOpacity : 0.68;
  const displayScale = typeof body.displayScale === "number" ? body.displayScale : 1;
  if (displayOpacity < 0.2 || displayOpacity > 1 || displayScale < 0.5 || displayScale > 1.5) throw new Error("INVALID_TREATMENT");
  const image = resolveBrandImage(workspaceId, "trusted-logos", { key: logoStorageKey, url: optionalText(body.logoUrl, 1500) }, existing ? { key: existing.logoStorageKey, url: existing.logoUrl } : null, getPublicAssetUrl);
  return { organizationName, logoStorageKey: image.key, logoUrl: image.url!, logoAlt: optionalText(body.logoAlt, 240) || organizationName, websiteUrl: validUrl(body.websiteUrl), monochrome: body.monochrome !== false, displayColor, displayOpacity, displayScale };
}

function refresh() { revalidatePath("/"); revalidatePath("/admin/trusted-logos"); }

function validationMessage(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "INVALID_BRAND_IMAGE") return "Upload an image for this workspace or keep the existing image unchanged.";
  return ({ INVALID_NAME: "An organization name between 1 and 160 characters is required.", INVALID_URL: "The organization website must be a valid web address.", INVALID_KEY: "The logo storage location is invalid.", MISSING_LOGO: "A logo image is required.", INVALID_COLOR: "Choose a valid six-digit display color.", INVALID_TREATMENT: "The logo scale or opacity is outside the supported range.", TEXT_TOO_LONG: "One or more fields exceed the allowed length." } as Record<string, string>)[error.message] ?? null;
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const body = (await request.json()) as Record<string, unknown>;
    const data = validate(body, session.workspaceId);
    await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "trusted-logos", key: data.logoStorageKey });
    const logo = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
      if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
      const scope = await getContentOwnershipScope(session.workspaceId, tx);
      if ("OR" in scope) await tx.$queryRaw`LOCK TABLE "TrustedLogo" IN SHARE ROW EXCLUSIVE MODE`;
      await lockRegisteredBrandImage(tx, { workspaceId: session.workspaceId, kind: "trusted-logos", key: data.logoStorageKey });
      const order = await tx.trustedLogo.aggregate({ where: { ...scope }, _max: { displayOrder: true } });
      return tx.trustedLogo.create({ data: { ...data, workspaceId: session.workspaceId, displayOrder: (order._max.displayOrder ?? -1) + 1, published: body.published === true }, select: logoSelect });
    });
    refresh();
    return NextResponse.json({ success: true, logo }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Logo access is no longer available." }, { status: 403 });
    if (error instanceof Error && error.message === "LOGO_UNAVAILABLE") return NextResponse.json({ success: false, error: "The logo was not found." }, { status: 404 });
    if (error instanceof Error && ["LOGO_REORDER_CONFLICT", "LOGO_IMAGE_CONFLICT", "LOGO_DELETE_CONFLICT"].includes(error.message)) return NextResponse.json({ success: false, error: "The logo changed. Refresh and try again." }, { status: 409 });
    const message = validationMessage(error);
    if (message) return NextResponse.json({ success: false, error: message }, { status: 400 });
    console.error("Unable to create trusted logo:", error);
    return NextResponse.json({ success: false, error: "The trusted logo could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const scope = await getContentOwnershipScope(session.workspaceId);
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "reorder") {
      const ids = Array.isArray(body.logoIds) ? body.logoIds.filter((id): id is string => typeof id === "string") : [];
      await prisma.$transaction(async tx => {
        await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
        if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
        const currentScope = await getContentOwnershipScope(session.workspaceId, tx);
        const includesLegacy = "OR" in currentScope;
        if (includesLegacy) await tx.$queryRaw`LOCK TABLE "TrustedLogo" IN SHARE ROW EXCLUSIVE MODE`;
        await tx.$queryRaw`SELECT id FROM "TrustedLogo" WHERE "workspaceId"=${session.workspaceId} OR (${includesLegacy} AND "workspaceId" IS NULL) ORDER BY id FOR UPDATE`;
        const current = await tx.trustedLogo.findMany({ where: { ...currentScope }, select: { id: true } });
        if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) throw new Error("LOGO_REORDER_CONFLICT");
        for (const [displayOrder, id] of ids.entries()) {
          const changed = await tx.trustedLogo.updateMany({ where: { id, ...currentScope }, data: { displayOrder } });
          if (changed.count !== 1) throw new Error("LOGO_REORDER_CONFLICT");
        }
      });
      refresh();
      return NextResponse.json({ success: true, logoIds: ids });
    }

    const logoId = typeof body.logoId === "string" ? body.logoId : "";
    if (!logoId) return NextResponse.json({ success: false, error: "A logo ID is required." }, { status: 400 });
    if (action === "set-published") {
      if (typeof body.published !== "boolean") return NextResponse.json({ success: false, error: "A valid publishing status is required." }, { status: 400 });
      const logo = await prisma.$transaction(async tx => {
        await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
        if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
        const currentScope = await getContentOwnershipScope(session.workspaceId, tx);
        await tx.$queryRaw`SELECT id FROM "TrustedLogo" WHERE id=${logoId} FOR UPDATE`;
        const changed = await tx.trustedLogo.updateMany({ where: { id: logoId, ...currentScope }, data: { published: body.published as boolean } });
        if (changed.count !== 1) throw new Error("LOGO_UNAVAILABLE");
        return tx.trustedLogo.findFirstOrThrow({ where: { id: logoId, ...currentScope }, select: logoSelect });
      });
      refresh();
      return NextResponse.json({ success: true, logo });
    }
    if (action === "update") {
      const existing = await prisma.trustedLogo.findFirst({ where: { id: logoId, ...scope }, select: { logoStorageKey: true, logoUrl: true } });
      if (!existing) return NextResponse.json({ success: false, error: "The logo was not found." }, { status: 404 });
      const data = validate(body, session.workspaceId, existing);
      await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "trusted-logos", key: data.logoStorageKey, existingKey: existing.logoStorageKey });
      const result = await prisma.$transaction(async tx => {
        await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
        if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
        const currentScope = await getContentOwnershipScope(session.workspaceId, tx);
        await tx.$queryRaw`SELECT id FROM "TrustedLogo" WHERE id=${logoId} FOR UPDATE`;
        const current = await tx.trustedLogo.findFirst({ where: { id: logoId, ...currentScope }, select: { logoStorageKey: true, logoUrl: true } });
        if (!current) throw new Error("LOGO_UNAVAILABLE");
        if (current.logoStorageKey !== existing.logoStorageKey || current.logoUrl !== existing.logoUrl) throw new Error("LOGO_IMAGE_CONFLICT");
        await lockRegisteredBrandImage(tx, { workspaceId: session.workspaceId, kind: "trusted-logos", key: data.logoStorageKey, existingKey: current.logoStorageKey });
        const changed = await tx.trustedLogo.updateMany({ where: { id: logoId, ...currentScope }, data: { ...data, ...(typeof body.published === "boolean" ? { published: body.published } : {}) } });
        if (changed.count !== 1) throw new Error("LOGO_UNAVAILABLE");
        const logo = await tx.trustedLogo.findFirstOrThrow({ where: { id: logoId, ...currentScope }, select: logoSelect });
        return { logo, storageCleanupPending: data.logoStorageKey !== current.logoStorageKey ? brandImageCleanupPending(current.logoStorageKey) : false };
      });
      refresh();
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.json({ success: false, error: "Unsupported logo action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Logo access is no longer available." }, { status: 403 });
    if (error instanceof Error && error.message === "LOGO_UNAVAILABLE") return NextResponse.json({ success: false, error: "The logo was not found." }, { status: 404 });
    if (error instanceof Error && ["LOGO_REORDER_CONFLICT", "LOGO_IMAGE_CONFLICT", "LOGO_DELETE_CONFLICT"].includes(error.message)) return NextResponse.json({ success: false, error: "The logo changed. Refresh and try again." }, { status: 409 });
    const message = validationMessage(error);
    if (message) return NextResponse.json({ success: false, error: message }, { status: 400 });
    console.error("Unable to update trusted logo:", error);
    return NextResponse.json({ success: false, error: "The trusted logo could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const logoId = new URL(request.url).searchParams.get("logoId")?.trim();
    if (!logoId) return NextResponse.json({ success: false, error: "A logo ID is required." }, { status: 400 });
    const result = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
      if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
      const scope = await getContentOwnershipScope(session.workspaceId, tx);
      await tx.$queryRaw`SELECT id FROM "TrustedLogo" WHERE id=${logoId} FOR UPDATE`;
      const logo = await tx.trustedLogo.findFirst({ where: { id: logoId, ...scope }, select: { id: true, logoStorageKey: true } });
      if (!logo) throw new Error("LOGO_UNAVAILABLE");
      const deleted = await tx.trustedLogo.deleteMany({ where: { id: logo.id, ...scope } });
      if (deleted.count !== 1) throw new Error("LOGO_DELETE_CONFLICT");
      return { deletedLogoId: logo.id, storageCleanupPending: brandImageCleanupPending(logo.logoStorageKey) };
    });
    refresh();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Logo access is no longer available." }, { status: 403 });
    if (error instanceof Error && error.message === "LOGO_UNAVAILABLE") return NextResponse.json({ success: false, error: "The logo was not found." }, { status: 404 });
    if (error instanceof Error && ["LOGO_REORDER_CONFLICT", "LOGO_IMAGE_CONFLICT", "LOGO_DELETE_CONFLICT"].includes(error.message)) return NextResponse.json({ success: false, error: "The logo changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to delete trusted logo:", error);
    return NextResponse.json({ success: false, error: "The trusted logo could not be deleted." }, { status: 500 });
  }
}
