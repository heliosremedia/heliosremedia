import { workspaceIsActive } from "@/lib/workspace-lifecycle/state";
import { membershipWritesEnabled } from "@/lib/workspace-membership-lifecycle";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashInvitationToken } from "@/lib/auth/invitations";
import { hashPassword } from "@/lib/auth/password";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 12 || !/[a-z]/i.test(password) || !/\d/.test(password)) return NextResponse.json({ success: false, error: "Use at least 12 characters with a letter and number." }, { status: 400 });
  const invitation = await prisma.adminInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) } });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) return NextResponse.json({ success: false, error: "This invitation is invalid or expired." }, { status: 400 });
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${invitation.workspaceId} FOR UPDATE`;
    if (!await workspaceIsActive(tx, invitation.workspaceId)) return null;
    await tx.$queryRaw`SELECT id FROM "AdminInvitation" WHERE id=${invitation.id} FOR UPDATE`;
    const current = await tx.adminInvitation.findFirst({ where: { id: invitation.id, workspaceId: invitation.workspaceId, tokenHash: hashInvitationToken(token), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!current) return null;
    const claimed = await tx.adminInvitation.updateMany({ where: { id: current.id, workspaceId: current.workspaceId, tokenHash: current.tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) return null;
    const created = await tx.adminUser.create({ data: { email: current.email, displayName: current.displayName, title: current.title, firstName: current.firstName, lastName: current.lastName, phone: current.phone, disciplines: current.disciplines, role: current.role, passwordHash, workspaceId: current.workspaceId } });
    if (membershipWritesEnabled()) await tx.workspaceMembership.create({ data: { userId: created.id, workspaceId: created.workspaceId, role: created.role, status: "ACTIVE" } });
    return created;
  });
  if (!user) return NextResponse.json({ success: false, error: "This invitation is no longer available." }, { status: 409 });
  await recordAuditEvent({ workspaceId: user.workspaceId, actorId: user.id, actorEmail: user.email, action: "USER_INVITATION_ACCEPTED", entityType: "AdminUser", entityId: user.id, summary: `${user.email} activated an admin account.` });
  return NextResponse.json({ success: true });
}
