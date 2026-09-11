import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { ClientPortalProvider } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { cleanText, cleanUrl, slugify } from "@/lib/client-portal/validation";
import { prisma } from "@/lib/prisma";

const select = { id: true, name: true, slug: true, description: true, provider: true, hdphGroupId: true, loginUrl: true, registrationUrl: true, bookingUrl: true, registrationEnabled: true, isDefault: true, active: true, displayOrder: true, createdAt: true, updatedAt: true } as const;

function provider(value: unknown): ClientPortalProvider {
  if (value === "HDPHOTOHUB" || value === "EXTERNAL") return value;
  throw new Error("INVALID_PROVIDER");
}

function groupId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0) throw new Error("INVALID_GROUP");
  return result;
}

function revalidate() {
  revalidatePath("/admin/client-portals");
  revalidatePath("/client-portal");
}

export async function GET() {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const scope = await getContentOwnershipScope(session.workspaceId);
  const portals = await prisma.clientPortal.findMany({ where: scope, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select });
  return NextResponse.json({ success: true, portals });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const scope = await getContentOwnershipScope(session.workspaceId);
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = cleanText(body.name, 120, true)!;
    const requestedSlug = slugify(typeof body.slug === "string" ? body.slug : name);
    if (!requestedSlug) throw new Error("INVALID_TEXT");
    const existing = await prisma.clientPortal.findUnique({ where: { slug: requestedSlug }, select: { id: true } });
    if (existing) throw new Error("DUPLICATE_SLUG");
    const max = await prisma.clientPortal.aggregate({ where: scope, _max: { displayOrder: true } });
    const isDefault = body.isDefault === true;
    const data = {
      workspaceId: session.workspaceId,
      name,
      slug: requestedSlug,
      description: cleanText(body.description, 500),
      provider: provider(body.provider),
      hdphGroupId: groupId(body.hdphGroupId),
      loginUrl: cleanUrl(body.loginUrl),
      registrationUrl: cleanUrl(body.registrationUrl),
      bookingUrl: cleanUrl(body.bookingUrl),
      registrationEnabled: body.registrationEnabled !== false,
      isDefault,
      active: body.active !== false,
      displayOrder: (max._max.displayOrder ?? -1) + 1,
    };
    const portal = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id"=${session.workspaceId} FOR UPDATE`;
      if (isDefault) await tx.clientPortal.updateMany({ where: { ...scope, isDefault: true }, data: { isDefault: false } });
      return tx.clientPortal.create({ data, select });
    });
    revalidate();
    return NextResponse.json({ success: true, portal }, { status: 201 });
  } catch (error) {
    const messages: Record<string, string> = { INVALID_TEXT: "Enter a valid portal name and slug.", INVALID_PROVIDER: "Choose a supported provider.", INVALID_GROUP: "Choose a valid HDPhotoHub group.", INVALID_URL: "One or more portal links are invalid.", DUPLICATE_SLUG: "That portal URL is already in use." };
    if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 });
    console.error("Unable to create client portal:", error);
    return NextResponse.json({ success: false, error: "The client portal could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const scope = await getContentOwnershipScope(session.workspaceId);
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "reorder") {
      if (!Array.isArray(body.portalIds) || body.portalIds.length === 0 || !body.portalIds.every((value) => typeof value === "string" && value.trim())) {
        return NextResponse.json({ success: false, error: "A complete ordered portal list is required." }, { status: 400 });
      }
      const portalIds = body.portalIds.map((value) => (value as string).trim());
      if (new Set(portalIds).size !== portalIds.length) return NextResponse.json({ success: false, error: "The portal order contains duplicate IDs." }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id"=${session.workspaceId} FOR UPDATE`;
        const current = await tx.clientPortal.findMany({ where: scope, select: { id: true } });
        const requested = new Set(portalIds);
        if (current.length !== portalIds.length || current.some(({ id }) => !requested.has(id))) throw new Error("STALE_PORTAL_ORDER");
        for (const [displayOrder, id] of portalIds.entries()) await tx.clientPortal.update({ where: { id, ...scope }, data: { displayOrder } });
      });
      revalidate();
      return NextResponse.json({ success: true, portalIds });
    }
    const id = cleanText(body.id, 100, true)!;
    const name = cleanText(body.name, 120, true)!;
    const slug = slugify(typeof body.slug === "string" ? body.slug : name);
    const isDefault = body.isDefault === true;
    const data = { name, slug, description: cleanText(body.description, 500), provider: provider(body.provider), hdphGroupId: groupId(body.hdphGroupId), loginUrl: cleanUrl(body.loginUrl), registrationUrl: cleanUrl(body.registrationUrl), bookingUrl: cleanUrl(body.bookingUrl), registrationEnabled: body.registrationEnabled !== false, isDefault, active: body.active !== false };
    const portal = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id"=${session.workspaceId} FOR UPDATE`;
      if (!await tx.clientPortal.findFirst({ where: { id, ...scope }, select: { id: true } })) throw new Error("PORTAL_NOT_FOUND");
      if (isDefault) await tx.clientPortal.updateMany({ where: { ...scope, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      return tx.clientPortal.update({ where: { id, ...scope }, data, select });
    });
    revalidate();
    return NextResponse.json({ success: true, portal });
  } catch (error) {
    if (error instanceof Error && error.message === "PORTAL_NOT_FOUND") return NextResponse.json({ success: false, error: "Portal not found." }, { status: 404 });
    console.error("Unable to update client portal:", error);
    return NextResponse.json({ success: false, error: "The client portal could not be updated. Check its name, group, and links." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const scope = await getContentOwnershipScope(session.workspaceId);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Portal ID required." }, { status: 400 });
  const deleted = await prisma.clientPortal.deleteMany({ where: { id, ...scope } });
  if (!deleted.count) return NextResponse.json({ success: false, error: "Portal not found." }, { status: 404 });
  revalidate();
  return NextResponse.json({ success: true });
}
