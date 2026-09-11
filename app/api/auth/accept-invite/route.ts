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
    const claimed = await tx.adminInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) return null;
    const created = await tx.adminUser.create({ data: { email: invitation.email, displayName: invitation.displayName, title: invitation.title, firstName: invitation.firstName, lastName: invitation.lastName, phone: invitation.phone, disciplines: invitation.disciplines, role: invitation.role, passwordHash, workspaceId: invitation.workspaceId } });
    if (membershipWritesEnabled()) await tx.workspaceMembership.create({ data: { userId: created.id, workspaceId: created.workspaceId, role: created.role, status: "ACTIVE" } });
    return created;
  });
  if (!user) return NextResponse.json({ success: false, error: "This invitation is no longer available." }, { status: 409 });
  await recordAuditEvent({ workspaceId: user.workspaceId, actorId: user.id, actorEmail: user.email, action: "USER_INVITATION_ACCEPTED", entityType: "AdminUser", entityId: user.id, summary: `${user.email} activated an admin account.` });
  return NextResponse.json({ success: true });
}
