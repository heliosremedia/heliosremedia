import "server-only";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { lifecycleEnabled, workspaceIsActive } from "./state.ts";
export { lifecycleEnabled, workspaceIsActive } from "./state.ts";
import type { WorkspaceWriteActor } from "../workspace-write-access.ts";

export class LifecycleDenied extends Error {}
export class LifecycleInvalid extends Error {}
export class LifecycleConflict extends Error {}

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
    // Capture the database clock AFTER obtaining the workspace lock. Transaction-start
    // timestamps could precede a long wait and incorrectly admit missed schedules.
    const cutoff = state === "ACTIVE"
      ? (await tx.$queryRaw<Array<{ at: Date }>>`SELECT date_trunc('milliseconds', clock_timestamp()) AS at`)[0].at
      : undefined;
    const result = await tx.workspace.update({ where: { id: target }, data: { lifecycleState: state, lifecycleRevision: { increment: 1 }, ...(cutoff ? { lastReactivatedAt: cutoff } : {}) }, select: { id: true, lifecycleState: true, lifecycleRevision: true } });
    await tx.auditEvent.create({ data: { workspaceId: target, actorId: actor.userId, action: "WORKSPACE_LIFECYCLE_CHANGED", entityType: "Workspace", entityId: target,
      summary: "Workspace lifecycle changed", metadata: { requestId: randomUUID(), reason, from: current.lifecycleState, to: state, previousRevision: revision, revision: result.lifecycleRevision, ...(cutoff ? { reactivatedAt: cutoff.toISOString() } : {}) } } });
    return result;
  });
}
