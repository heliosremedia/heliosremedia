import type { Prisma } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "./workspace-context-core.ts";
import { resolveMembershipAccess } from "./workspace-membership-core.ts";

export type WorkspaceWriteActor = { userId: string; workspaceId: string; sessionVersion: number };

/** Use the same workspace/account lock order as account and membership mutations. */
export async function requireLockedWorkspaceEditor(tx: Prisma.TransactionClient, actor: WorkspaceWriteActor) {
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${actor.workspaceId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${actor.userId} AND "workspaceId" = ${actor.workspaceId} FOR UPDATE`;
  const enabled = tenantContextEnabled();
  if (enabled) await tx.$queryRaw`SELECT id FROM "WorkspaceMembership" WHERE "userId" = ${actor.userId} AND "workspaceId" = ${actor.workspaceId} FOR UPDATE`;
  const user = await tx.adminUser.findFirst({ where: { id: actor.userId, workspaceId: actor.workspaceId }, select: { id: true, active: true, workspaceId: true, role: true, sessionVersion: true } });
  if (!user || user.sessionVersion !== actor.sessionVersion) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
  const access = await resolveMembershipAccess(user, enabled, (userId, workspaceId) => tx.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } }));
  if (!access || !["OWNER", "ADMIN", "EDITOR"].includes(access.role)) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
}
