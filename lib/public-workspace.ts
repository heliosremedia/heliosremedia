import "server-only";

import { prisma } from "@/lib/prisma";

export async function getPublicWorkspaceId() {
  const settings = await prisma.siteSettings.findFirst({
    where: { workspaceId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { workspaceId: true },
  });
  if (settings?.workspaceId) return settings.workspaceId;

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!workspace) throw new Error("A public workspace is not configured.");
  return workspace.id;
}
