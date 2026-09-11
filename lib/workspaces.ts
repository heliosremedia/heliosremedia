import "server-only";
import { getWorkspaceAccess } from "@/lib/workspace-memberships";
import { prisma } from "@/lib/prisma";

export async function requireWorkspaceId(userId: string) {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, active: true, workspaceId: true, role: true },
  });
  if (!user?.workspaceId) throw new Error("Workspace access is not configured.");
  const access = await getWorkspaceAccess(user);
  if (!access) throw new Error("Workspace access is not configured.");
  return access.workspaceId;
}
