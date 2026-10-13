import { workspaceIsActive } from "@/lib/workspace-lifecycle/state";
import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { resolveMembershipAccess, type MembershipRole } from "@/lib/workspace-membership-core";

export async function getWorkspaceAccess(user: { id: string; active: boolean; workspaceId: string; role: MembershipRole }) {
  const access = await resolveMembershipAccess(user, tenantContextEnabled(), (userId, workspaceId) =>
    prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { userId: true, workspaceId: true, role: true, status: true },
    }),
  );
  return access && await workspaceIsActive(prisma, access.workspaceId) ? access : null;
}
