import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "../workspace-context-core.ts";
import type { WorkspaceWriteActor } from "../workspace-write-access.ts";

export function lifecycleEnabled() {
  return tenantContextEnabled() && process.env.STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED?.trim().toLowerCase() === "true";
}
export class LifecycleDenied extends Error {}
export class LifecycleInvalid extends Error {}
export class LifecycleConflict extends Error {}

/** Default-off compatibility gate. Callers must retain their own authorization. */
export async function workspaceIsActive(db: Pick<Prisma.TransactionClient, "workspace">, workspaceId: string) {
  if (!lifecycleEnabled()) return true;
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { lifecycleState: true } });
  return workspace?.lifecycleState === "ACTIVE";
}

/** Internal control-plane core. No public/tenant transition or enrollment API. */
export async function transitionWorkspaceLifecycle(db: Pick<PrismaClient, "$transaction">, actor: WorkspaceWriteActor, input: {
  workspaceId: string; expectedRevision: number; state: "ACTIVE" | "SUSPENDED"; reason: string;
}) {
  if (!lifecycleEnabled()) throw new LifecycleDenied();
  actor = { ...actor };
  const target = input.workspaceId, state = input.state, revision = input.expectedRevision;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (typeof target !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(target) || !["ACTIVE", "SUSPENDED"].includes(state)
    || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647 || !reason || reason.length > 600) throw new LifecycleInvalid();
  return db.$transaction(async tx => {
    // Both workspaces precede identity locks; sorted order permits reciprocal operations.
    for (const id of [...new Set([target, actor.workspaceId])].sort()) await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id=${actor.userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "WorkspaceMembership" WHERE "workspaceId"=${actor.workspaceId} AND "userId"=${actor.userId} FOR SHARE`;
    await tx.$queryRaw`SELECT "userId" FROM "PlatformLifecycleOperator" WHERE "userId"=${actor.userId} FOR SHARE`;
    const user = await tx.adminUser.findUnique({ where: { id: actor.userId }, select: { active: true, workspaceId: true, sessionVersion: true } });
    const membership = await tx.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId: actor.userId } }, select: { status: true } });
    const operator = await tx.platformLifecycleOperator.findUnique({ where: { userId: actor.userId }, select: { enabled: true } });
    if (!user?.active || user.workspaceId !== actor.workspaceId || user.sessionVersion !== actor.sessionVersion || membership?.status !== "ACTIVE" || !operator?.enabled || !await workspaceIsActive(tx, actor.workspaceId)) throw new LifecycleDenied();
    const current = await tx.workspace.findUnique({ where: { id: target }, select: { lifecycleState: true, lifecycleRevision: true } });
    if (!current) throw new LifecycleDenied();
    if (current.lifecycleRevision !== revision || current.lifecycleState === state) throw new LifecycleConflict();
    const result = await tx.workspace.update({ where: { id: target }, data: { lifecycleState: state, lifecycleRevision: { increment: 1 } }, select: { id: true, lifecycleState: true, lifecycleRevision: true } });
    await tx.auditEvent.create({ data: { workspaceId: target, actorId: actor.userId, action: "WORKSPACE_LIFECYCLE_CHANGED", entityType: "Workspace", entityId: target,
      summary: "Workspace lifecycle changed", metadata: { requestId: randomUUID(), reason, from: current.lifecycleState, to: state, previousRevision: revision, revision: result.lifecycleRevision } } });
    return result;
  });
}
