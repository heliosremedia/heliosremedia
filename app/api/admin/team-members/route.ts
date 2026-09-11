import { getAdminSession } from "@/lib/auth/session";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { resolveBrandImage, brandImageCleanupPending } from "@/lib/workspace-brand-storage";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { TeamMemberCategory } from "@/app/generated/prisma/client";
import { verifyContentImage } from "@/lib/content-image-storage";
import { prisma } from "@/lib/prisma";
import { teamMemberCategories, teamMemberSelect } from "@/lib/team-members";

function text(value: unknown, max: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > max) throw new Error("INVALID_TEXT");
  return result || null;
}
function portraitKey(value: unknown) {
  const result = text(value, 1000);
  return result;
}
function url(value: unknown) {
  const result = text(value, 1500);
  if (!result) return null;
  const parsed = new URL(result);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("INVALID_IMAGE");
  return parsed.toString();
}
function category(value: unknown): TeamMemberCategory {
  if (typeof value === "string" && teamMemberCategories.includes(value as TeamMemberCategory)) return value as TeamMemberCategory;
  return "PRODUCTION";
}
function point(value: unknown, fallback: number) { return typeof value === "number" ? Math.min(1, Math.max(0, value)) : fallback; }
function data(body: Record<string, unknown>, workspaceId: string, existing: { portraitStorageKey: string | null; portraitUrl: string | null } | null = null) {
  const portrait = resolveBrandImage(workspaceId, "team", { key: portraitKey(body.portraitStorageKey), url: url(body.portraitUrl) }, existing ? { key: existing.portraitStorageKey, url: existing.portraitUrl } : null, getPublicAssetUrl);
  return {
    name: text(body.name, 120, true) as string,
    title: text(body.title, 160, true) as string,
    biography: text(body.biography, 1200, true) as string,
    category: category(body.category),
    portraitStorageKey: portrait.key,
    portraitUrl: portrait.url,
    portraitAlt: text(body.portraitAlt, 240),
    focalX: point(body.focalX, 0.5),
    focalY: point(body.focalY, 0.25),
    visible: body.visible === true,
  };
}
function refresh() { revalidatePath("/about"); revalidatePath("/admin/about"); }
function bad(error: unknown) { return error instanceof Error && ["INVALID_TEXT", "INVALID_IMAGE", "INVALID_BRAND_IMAGE"].includes(error.message); }

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const scope = await getContentOwnershipScope(session.workspaceId);
    const body = (await request.json()) as Record<string, unknown>;
    const validated = data(body, session.workspaceId);
    await verifyContentImage(validated.portraitStorageKey);
    const order = await prisma.teamMember.aggregate({ where: scope, _max: { displayOrder: true } });
    const teamMember = await prisma.teamMember.create({ data: { workspaceId: session.workspaceId, ...validated, displayOrder: (order._max.displayOrder ?? -1) + 1 }, select: teamMemberSelect });
    refresh();
    return NextResponse.json({ success: true, teamMember }, { status: 201 });
  } catch (error) {
    if (bad(error)) return NextResponse.json({ success: false, error: "Complete the team member fields with valid text and portrait details." }, { status: 400 });
    console.error("Unable to create team member:", error);
    return NextResponse.json({ success: false, error: "The team member could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const scope = await getContentOwnershipScope(session.workspaceId);
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "reorder") {
      const ids = Array.isArray(body.teamMemberIds) ? body.teamMemberIds.filter((id): id is string => typeof id === "string") : [];
      const current = await prisma.teamMember.findMany({ where: scope, select: { id: true } });
      if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) return NextResponse.json({ success: false, error: "The team list changed. Refresh and try again." }, { status: 409 });
      await prisma.$transaction(ids.map((id, displayOrder) => prisma.teamMember.update({ where: { id, AND: [scope] }, data: { displayOrder } })));
      refresh(); return NextResponse.json({ success: true, teamMemberIds: ids });
    }
    const teamMemberId = typeof body.teamMemberId === "string" ? body.teamMemberId : "";
    if (!teamMemberId) return NextResponse.json({ success: false, error: "A team member ID is required." }, { status: 400 });
    const existing = await prisma.teamMember.findUnique({ where: { id: teamMemberId, AND: [scope] }, select: { portraitStorageKey: true, portraitUrl: true } });
    if (!existing) return NextResponse.json({ success: false, error: "The team member was not found." }, { status: 404 });
    const validated = data(body, session.workspaceId, existing);
    if (validated.portraitStorageKey !== existing.portraitStorageKey) await verifyContentImage(validated.portraitStorageKey);
    const teamMember = await prisma.teamMember.update({ where: { id: teamMemberId, AND: [scope] }, data: validated, select: teamMemberSelect });
    const storageCleanupPending = validated.portraitStorageKey !== existing.portraitStorageKey ? brandImageCleanupPending(existing.portraitStorageKey) : false;
    refresh();
    return NextResponse.json({ success: true, teamMember, storageCleanupPending });
  } catch (error) {
    if (bad(error)) return NextResponse.json({ success: false, error: "Complete the team member fields with valid text and portrait details." }, { status: 400 });
    console.error("Unable to update team member:", error);
    return NextResponse.json({ success: false, error: "The team member could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const scope = await getContentOwnershipScope(session.workspaceId);
    const teamMemberId = new URL(request.url).searchParams.get("teamMemberId")?.trim();
    if (!teamMemberId) return NextResponse.json({ success: false, error: "A team member ID is required." }, { status: 400 });
    const deleted = await prisma.teamMember.delete({ where: { id: teamMemberId, AND: [scope] }, select: { id: true, portraitStorageKey: true } });
    const storageCleanupPending = brandImageCleanupPending(deleted.portraitStorageKey);
    refresh();
    return NextResponse.json({ success: true, deletedTeamMemberId: deleted.id, storageCleanupPending });
  } catch (error) {
    console.error("Unable to delete team member:", error);
    return NextResponse.json({ success: false, error: "The team member could not be deleted." }, { status: 500 });
  }
}
