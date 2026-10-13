import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { getAdminSession } from "@/lib/auth/session";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { resolveBrandImage, brandImageCleanupPending } from "@/lib/workspace-brand-storage";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { TeamMemberCategory } from "@/app/generated/prisma/client";
import { verifyRegisteredBrandImage, lockRegisteredBrandImage } from "@/lib/workspace-brand-assets";
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
    const body = (await request.json()) as Record<string, unknown>;
    const validated = data(body, session.workspaceId);
    await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "team", key: validated.portraitStorageKey });
    const teamMember = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
      if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
      const scope = await getContentOwnershipScope(session.workspaceId, tx);
      if ("OR" in scope) await tx.$queryRaw`LOCK TABLE "TeamMember" IN SHARE ROW EXCLUSIVE MODE`;
      await lockRegisteredBrandImage(tx, { workspaceId: session.workspaceId, kind: "team", key: validated.portraitStorageKey });
      const order = await tx.teamMember.aggregate({ where: scope, _max: { displayOrder: true } });
      return tx.teamMember.create({ data: { workspaceId: session.workspaceId, ...validated, displayOrder: (order._max.displayOrder ?? -1) + 1 }, select: teamMemberSelect });
    });
    refresh();
    return NextResponse.json({ success: true, teamMember }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Team access is no longer available." }, { status: 403 });
    if (error instanceof Error && error.message === "TEAM_UNAVAILABLE") return NextResponse.json({ success: false, error: "The team member was not found." }, { status: 404 });
    if (error instanceof Error && ["TEAM_REORDER_CONFLICT", "TEAM_IMAGE_CONFLICT", "TEAM_DELETE_CONFLICT"].includes(error.message)) return NextResponse.json({ success: false, error: "The team member changed. Refresh and try again." }, { status: 409 });
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
      await prisma.$transaction(async tx => {
        await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
        if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
        const currentScope = await getContentOwnershipScope(session.workspaceId, tx);
        const includesLegacy = "OR" in currentScope;
        if (includesLegacy) await tx.$queryRaw`LOCK TABLE "TeamMember" IN SHARE ROW EXCLUSIVE MODE`;
        await tx.$queryRaw`SELECT id FROM "TeamMember" WHERE "workspaceId"=${session.workspaceId} OR (${includesLegacy} AND "workspaceId" IS NULL) ORDER BY id FOR UPDATE`;
        const current = await tx.teamMember.findMany({ where: currentScope, select: { id: true } });
        if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) throw new Error("TEAM_REORDER_CONFLICT");
        for (const [displayOrder, id] of ids.entries()) {
          const changed = await tx.teamMember.updateMany({ where: { id, ...currentScope }, data: { displayOrder } });
          if (changed.count !== 1) throw new Error("TEAM_REORDER_CONFLICT");
        }
      });
      refresh(); return NextResponse.json({ success: true, teamMemberIds: ids });
    }
    const teamMemberId = typeof body.teamMemberId === "string" ? body.teamMemberId : "";
    if (!teamMemberId) return NextResponse.json({ success: false, error: "A team member ID is required." }, { status: 400 });
    const existing = await prisma.teamMember.findUnique({ where: { id: teamMemberId, AND: [scope] }, select: { portraitStorageKey: true, portraitUrl: true } });
    if (!existing) return NextResponse.json({ success: false, error: "The team member was not found." }, { status: 404 });
    const validated = data(body, session.workspaceId, existing);
    await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "team", key: validated.portraitStorageKey, existingKey: existing.portraitStorageKey });
    const result = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
      if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
      const currentScope = await getContentOwnershipScope(session.workspaceId, tx);
      await tx.$queryRaw`SELECT id FROM "TeamMember" WHERE id=${teamMemberId} FOR UPDATE`;
      const current = await tx.teamMember.findFirst({ where: { id: teamMemberId, ...currentScope }, select: { portraitStorageKey: true, portraitUrl: true } });
      if (!current) throw new Error("TEAM_UNAVAILABLE");
      if (current.portraitStorageKey !== existing.portraitStorageKey || current.portraitUrl !== existing.portraitUrl) throw new Error("TEAM_IMAGE_CONFLICT");
      await lockRegisteredBrandImage(tx, { workspaceId: session.workspaceId, kind: "team", key: validated.portraitStorageKey, existingKey: current.portraitStorageKey });
      const changed = await tx.teamMember.updateMany({ where: { id: teamMemberId, ...currentScope }, data: validated });
      if (changed.count !== 1) throw new Error("TEAM_UNAVAILABLE");
      const teamMember = await tx.teamMember.findFirstOrThrow({ where: { id: teamMemberId, ...currentScope }, select: teamMemberSelect });
      return { teamMember, storageCleanupPending: validated.portraitStorageKey !== current.portraitStorageKey ? brandImageCleanupPending(current.portraitStorageKey) : false };
    });
    refresh();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Team access is no longer available." }, { status: 403 });
    if (error instanceof Error && error.message === "TEAM_UNAVAILABLE") return NextResponse.json({ success: false, error: "The team member was not found." }, { status: 404 });
    if (error instanceof Error && ["TEAM_REORDER_CONFLICT", "TEAM_IMAGE_CONFLICT", "TEAM_DELETE_CONFLICT"].includes(error.message)) return NextResponse.json({ success: false, error: "The team member changed. Refresh and try again." }, { status: 409 });
    if (bad(error)) return NextResponse.json({ success: false, error: "Complete the team member fields with valid text and portrait details." }, { status: 400 });
    console.error("Unable to update team member:", error);
    return NextResponse.json({ success: false, error: "The team member could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const teamMemberId = new URL(request.url).searchParams.get("teamMemberId")?.trim();
    if (!teamMemberId) return NextResponse.json({ success: false, error: "A team member ID is required." }, { status: 400 });
    const result = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, { workspaceId: session.workspaceId, userId: session.userId, sessionVersion: session.sessionVersion });
      if (!tenantContextEnabled()) await tx.$queryRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
      const scope = await getContentOwnershipScope(session.workspaceId, tx);
      await tx.$queryRaw`SELECT id FROM "TeamMember" WHERE id=${teamMemberId} FOR UPDATE`;
      const existing = await tx.teamMember.findFirst({ where: { id: teamMemberId, ...scope }, select: { id: true, portraitStorageKey: true } });
      if (!existing) throw new Error("TEAM_UNAVAILABLE");
      const deleted = await tx.teamMember.deleteMany({ where: { id: teamMemberId, ...scope } });
      if (deleted.count !== 1) throw new Error("TEAM_DELETE_CONFLICT");
      return { deletedTeamMemberId: existing.id, storageCleanupPending: brandImageCleanupPending(existing.portraitStorageKey) };
    });
    refresh();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Team access is no longer available." }, { status: 403 });
    if (error instanceof Error && error.message === "TEAM_UNAVAILABLE") return NextResponse.json({ success: false, error: "The team member was not found." }, { status: 404 });
    if (error instanceof Error && ["TEAM_REORDER_CONFLICT", "TEAM_IMAGE_CONFLICT", "TEAM_DELETE_CONFLICT"].includes(error.message)) return NextResponse.json({ success: false, error: "The team member changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to delete team member:", error);
    return NextResponse.json({ success: false, error: "The team member could not be deleted." }, { status: 500 });
  }
}
