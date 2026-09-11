import type { Prisma } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "./workspace-context-core.ts";

// Enable only after the additive membership migration is applied.
export function membershipWritesEnabled() {
  return tenantContextEnabled() || process.env.STUDIO_V2_MEMBERSHIP_WRITES_ENABLED === "true";
}

export async function updateCompatibilityMembership(
  tx: Prisma.TransactionClient,
  user: { id: string; workspaceId: string; role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER"; active: boolean },
  change: { role?: boolean; active?: boolean },
) {
  if (!membershipWritesEnabled() || (!change.role && !change.active)) return;
  await tx.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: user.workspaceId, userId: user.id } },
    create: { userId: user.id, workspaceId: user.workspaceId, role: user.role, status: user.active ? "ACTIVE" : "SUSPENDED" },
    update: {
      ...(change.role ? { role: user.role } : {}),
      ...(change.active ? { status: user.active ? "ACTIVE" : "SUSPENDED" } : {}),
    },
  });
}
