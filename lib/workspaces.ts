import "server-only";
import { prisma } from "@/lib/prisma";

export async function requireWorkspaceId(userId: string) {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) throw new Error("Workspace access is not configured.");
  return user.workspaceId;
}
