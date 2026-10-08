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
