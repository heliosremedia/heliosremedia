import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { createInvitationToken, hashInvitationToken } from "@/lib/auth/invitations";
import { getAbsoluteUrl } from "@/lib/site";
import { recordAuditEvent } from "@/lib/audit";
import type { AdminRole, TeamDiscipline } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";

const roles: AdminRole[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
const disciplineOptions: TeamDiscipline[] = ["PHOTOGRAPHER","VIDEOGRAPHER","DRONE_PILOT","EDITOR","CREATIVE_DIRECTOR","OTHER"];
async function ownerOrAdmin() {
  const session = await getAdminSession();
  return session && (session.role === "OWNER" || session.role === "ADMIN") ? session : null;
}

export async function POST(request: Request) {
  const session = await ownerOrAdmin();
  if (!session) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const role = typeof body.role === "string" && roles.includes(body.role as AdminRole) ? body.role as AdminRole : null;
  if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || displayName.length > 120 || title.length > 120 || !role) return NextResponse.json({ success: false, error: "Enter a valid name, email, title, and role." }, { status: 400 });
  if (role === "OWNER" && session.role !== "OWNER") return NextResponse.json({ success: false, error: "Only an owner can invite another owner." }, { status: 403 });
  const existing = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ success: false, error: "An account already uses this email." }, { status: 409 });
  await prisma.adminInvitation.updateMany({ where: { workspaceId: session.workspaceId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = createInvitationToken();
  const invitation = await prisma.adminInvitation.create({ data: { email, displayName, title: title || null, role, tokenHash: hashInvitationToken(token), createdById: session.userId, workspaceId: session.workspaceId, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "USER_INVITED", entityType: "AdminInvitation", entityId: invitation.id, summary: `${email} invited as ${role}.` });
  revalidatePath("/admin/users");
  return NextResponse.json({ success: true, invitationUrl: getAbsoluteUrl(`/accept-invite?token=${encodeURIComponent(token)}`) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await ownerOrAdmin();
  if (!session) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const userId = typeof body.userId === "string" ? body.userId : "";
  const action = typeof body.action === "string" ? body.action : "";
  const role = typeof body.role === "string" && roles.includes(body.role as AdminRole) ? body.role as AdminRole : null;
  const active = typeof body.active === "boolean" ? body.active : null;
  const password = typeof body.password === "string" ? body.password : null;
  const nextDisplayName = typeof body.displayName === "string" ? body.displayName.trim() : null;
  const nextTitle = typeof body.title === "string" ? body.title.trim() || null : undefined;
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() || null : undefined;
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() || null : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim().replace(/[^\d+]/g, "") || null : undefined;
  const selectedDisciplines = Array.isArray(body.disciplines) ? body.disciplines.filter((value): value is TeamDiscipline => typeof value === "string" && disciplineOptions.includes(value as TeamDiscipline)) : undefined;
  const target = await prisma.adminUser.findFirst({ where: { id: userId, workspaceId: session.workspaceId } });
  if (!target) return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
  if (action === "transferOwnership") {
    if (session.role !== "OWNER" || target.id === session.userId || !target.active) return NextResponse.json({ success: false, error: "Ownership can only be transferred by the current owner to another active workspace user." }, { status: 403 });
    await prisma.$transaction([
      prisma.adminUser.update({ where: { id: target.id }, data: { role: "OWNER" } }),
      prisma.adminUser.update({ where: { id: session.userId }, data: { role: "ADMIN", sessionVersion: { increment: 1 } } }),
    ]);
    await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "WORKSPACE_OWNERSHIP_TRANSFERRED", entityType: "Workspace", entityId: session.workspaceId, summary: `Workspace ownership transferred to ${target.email}.` });
    return NextResponse.json({ success: true, signedOut: true });
  }
  if (target.role === "OWNER" && session.role !== "OWNER") return NextResponse.json({ success: false, error: "Only an owner can manage owner accounts." }, { status: 403 });
  if (target.id === session.userId && active === false) return NextResponse.json({ success: false, error: "You cannot deactivate your own account." }, { status: 400 });
  if (role === "OWNER" && session.role !== "OWNER") return NextResponse.json({ success: false, error: "Only an owner can grant owner access." }, { status: 403 });
  if (target.role === "OWNER" && (role && role !== "OWNER" || active === false)) {
    const ownerCount = await prisma.adminUser.count({ where: { workspaceId: session.workspaceId, role: "OWNER", active: true } });
    if (ownerCount <= 1) return NextResponse.json({ success: false, error: "The final active owner cannot be demoted or deactivated." }, { status: 409 });
  }
  if (password !== null && (password.length < 12 || password.length > 128)) return NextResponse.json({ success: false, error: "Passwords must contain 12–128 characters." }, { status: 400 });
  if (password !== null && session.role !== "OWNER" && target.id !== session.userId) return NextResponse.json({ success: false, error: "Only an owner can reset another user's password." }, { status: 403 });
  if (nextDisplayName !== null && (!nextDisplayName || nextDisplayName.length > 120)) return NextResponse.json({ success: false, error: "Enter a valid display name." }, { status: 400 });
  if (nextTitle && nextTitle.length > 120) return NextResponse.json({ success: false, error: "Professional titles must contain no more than 120 characters." }, { status: 400 });
  if (phone && !/^\+?\d{7,15}$/.test(phone)) return NextResponse.json({ success: false, error: "Enter a valid phone number." }, { status: 400 });
  const passwordHash = password !== null ? await hashPassword(password) : null;
  const revokeSessions = password !== null || active === false;
  const updated = await prisma.adminUser.update({ where: { id: userId }, data: { ...(role ? { role } : {}), ...(active !== null ? { active, state: active ? "ACTIVE" : "DEACTIVATED" } : {}), ...(nextDisplayName !== null ? { displayName: nextDisplayName } : {}), ...(nextTitle !== undefined ? { title: nextTitle } : {}), ...(firstName !== undefined ? { firstName } : {}), ...(lastName !== undefined ? { lastName } : {}), ...(phone !== undefined ? { phone } : {}), ...(selectedDisciplines ? { disciplines: selectedDisciplines } : {}), ...(passwordHash ? { passwordHash, failedLoginCount: 0, lockedUntil: null } : {}), ...(revokeSessions ? { sessionVersion: { increment: 1 } } : {}) }, select: { id: true, displayName: true, title: true, firstName: true, lastName: true, phone: true, disciplines: true, role: true, active: true, state: true } });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: password !== null ? "USER_PASSWORD_RESET" : "USER_UPDATED", entityType: "AdminUser", entityId: userId, summary: password !== null ? `${target.email} password reset and active sessions revoked.` : `${target.email} account access updated.` });
  revalidatePath("/admin/users");
  return NextResponse.json({ success: true, user: updated });
}

export async function DELETE(request: Request) {
  const session = await ownerOrAdmin();
  if (!session) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
  const invitation = await prisma.adminInvitation.findFirst({ where: { id: invitationId, workspaceId: session.workspaceId, acceptedAt: null, revokedAt: null } });
  if (!invitation) return NextResponse.json({ success: false, error: "Invitation not found." }, { status: 404 });
  await prisma.adminInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "USER_INVITATION_REVOKED", entityType: "AdminInvitation", entityId: invitation.id, summary: `${invitation.email} invitation revoked.` });
  revalidatePath("/admin/users");
  return NextResponse.json({ success: true });
}
