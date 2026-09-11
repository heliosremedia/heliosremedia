import type { Prisma } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "./workspace-context-core.ts";
import { resolveMembershipAccess } from "./workspace-membership-core.ts";
import { getProtectedOwnerMutationError, isProtectedWorkspaceOwner } from "./workspace-account-policy.ts";

type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
type Session = { userId: string; workspaceId: string; sessionVersion: number };
type Change = { transfer?: boolean; role: Role | null; active: boolean | null; password: boolean };

// Call inside the transaction that performs the write. PATCH account edits and ownership transfers
// acquire this workspace lock before reading current permissions.
export async function checkLockedAccountMutation(
  tx: Prisma.TransactionClient, session: Session, targetId: string, change: Change,
) {
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${session.workspaceId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE "workspaceId" = ${session.workspaceId} AND (id = ${session.userId} OR id = ${targetId}) ORDER BY id FOR UPDATE`;
  const enabled = tenantContextEnabled();
  if (enabled) {
    await tx.$queryRaw`SELECT id FROM "WorkspaceMembership" WHERE "workspaceId" = ${session.workspaceId} AND ("userId" = ${session.userId} OR "userId" = ${targetId}) ORDER BY id FOR UPDATE`;
  }
  const actor = await tx.adminUser.findFirst({ where: { id: session.userId, workspaceId: session.workspaceId } });
  const target = await tx.adminUser.findFirst({ where: { id: targetId, workspaceId: session.workspaceId } });
  if (!actor || actor.sessionVersion !== session.sessionVersion || !target) return "Account access changed. Reload and try again.";
  const lookup = (userId: string, workspaceId: string) => tx.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  const access = await resolveMembershipAccess(actor, enabled, lookup);
  if (!access || !["OWNER", "ADMIN"].includes(access.role)) return "Owner or administrator access is required.";
  const membership = enabled ? await lookup(target.id, session.workspaceId) : null;
  if (change.transfer) {
    if (access.role !== "OWNER" || actor.id === target.id || !target.active || (enabled && membership?.status !== "ACTIVE")) {
      return "Ownership requires a current owner and another active workspace member.";
    }
    return null;
  }
  if (isProtectedWorkspaceOwner(target.role, membership?.role) && access.role !== "OWNER") return "Only an owner can manage owner accounts.";
  if (change.role === "OWNER" && access.role !== "OWNER") return "Only an owner can grant owner access.";
  if (change.active === false && actor.id === target.id) return "You cannot deactivate your own account.";
  if (change.password && actor.id !== target.id && access.role !== "OWNER") return "Only an owner can reset another user's password.";
  return getProtectedOwnerMutationError(target.role, change, membership?.role);
}
