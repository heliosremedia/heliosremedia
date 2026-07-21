import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { createInvitationToken, hashInvitationToken } from "@/lib/auth/invitations";
import { getAbsoluteUrl } from "@/lib/site";
import { recordAuditEvent } from "@/lib/audit";
import type { AdminRole } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";

const roles: AdminRole[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
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
  const role = typeof body.role === "string" && roles.includes(body.role as AdminRole) ? body.role as AdminRole : null;
  if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || displayName.length > 120 || !role) return NextResponse.json({ success: false, error: "Enter a valid name, email, and role." }, { status: 400 });
  if (role === "OWNER" && session.role !== "OWNER") return NextResponse.json({ success: false, error: "Only an owner can invite another owner." }, { status: 403 });
  const existing = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ success: false, error: "An account already uses this email." }, { status: 409 });
  await prisma.adminInvitation.updateMany({ where: { email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = createInvitationToken();
  const invitation = await prisma.adminInvitation.create({ data: { email, displayName, role, tokenHash: hashInvitationToken(token), createdById: session.userId, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "USER_INVITED", entityType: "AdminInvitation", entityId: invitation.id, summary: `${email} invited as ${role}.` });
  revalidatePath("/admin/users");
  return NextResponse.json({ success: true, invitationUrl: getAbsoluteUrl(`/accept-invite?token=${encodeURIComponent(token)}`) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await ownerOrAdmin();
  if (!session) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = typeof body.role === "string" && roles.includes(body.role as AdminRole) ? body.role as AdminRole : null;
  const active = typeof body.active === "boolean" ? body.active : null;
  const password = typeof body.password === "string" ? body.password : null;
  const target = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
  if (target.role === "OWNER" && session.role !== "OWNER") return NextResponse.json({ success: false, error: "Only an owner can manage owner accounts." }, { status: 403 });
  if (target.id === session.userId && active === false) return NextResponse.json({ success: false, error: "You cannot deactivate your own account." }, { status: 400 });
  if (role === "OWNER" && session.role !== "OWNER") return NextResponse.json({ success: false, error: "Only an owner can grant owner access." }, { status: 403 });
  if (password !== null && (password.length < 12 || password.length > 128)) return NextResponse.json({ success: false, error: "Passwords must contain 12–128 characters." }, { status: 400 });
  if (password !== null && session.role !== "OWNER" && target.id !== session.userId) return NextResponse.json({ success: false, error: "Only an owner can reset another user's password." }, { status: 403 });
  const passwordHash = password !== null ? await hashPassword(password) : null;
  const revokeSessions = password !== null || active === false;
  const updated = await prisma.adminUser.update({ where: { id: userId }, data: { ...(role ? { role } : {}), ...(active !== null ? { active } : {}), ...(passwordHash ? { passwordHash, failedLoginCount: 0, lockedUntil: null } : {}), ...(revokeSessions ? { sessionVersion: { increment: 1 } } : {}) }, select: { id: true, role: true, active: true } });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: password !== null ? "USER_PASSWORD_RESET" : "USER_UPDATED", entityType: "AdminUser", entityId: userId, summary: password !== null ? `${target.email} password reset and active sessions revoked.` : `${target.email} account access updated.` });
  revalidatePath("/admin/users");
  return NextResponse.json({ success: true, user: updated });
}
