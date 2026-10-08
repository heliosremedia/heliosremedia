import type { Prisma } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "../workspace-context-core.ts";

export function lifecycleEnabled() {
  return tenantContextEnabled() && process.env.STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED?.trim().toLowerCase() === "true";
}
/** Default-off compatibility gate. Callers must retain their own authorization. */
export async function workspaceIsActive(db: Pick<Prisma.TransactionClient, "workspace">, workspaceId: string) {
  if (!lifecycleEnabled()) return true;
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { lifecycleState: true } });
  return workspace?.lifecycleState === "ACTIVE";
}

/** Caller must hold the Workspace lock before admitting any new scheduled action.
 * Settlement and verified safety callbacks must not use this new-work guard.
 */
export async function requireWorkspaceScheduledAction(
  db: Pick<Prisma.TransactionClient, "workspace">, workspaceId: string, dueAt: Date,
) {
  if (!lifecycleEnabled()) return;
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId }, select: { lifecycleState: true, lastReactivatedAt: true },
  });
  if (!workspace || workspace.lifecycleState !== "ACTIVE") throw new Error("WORKSPACE_SCHEDULE_SUSPENDED");
  if (!Number.isFinite(dueAt.getTime()) || (workspace.lastReactivatedAt && dueAt <= workspace.lastReactivatedAt)) {
    throw new Error("WORKSPACE_SCHEDULE_RECOVERY_REQUIRED");
  }
}
