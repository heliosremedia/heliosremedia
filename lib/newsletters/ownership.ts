import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

export async function resolveNewsletterWorkspace(storedWorkspaceId: string | null) {
  if (storedWorkspaceId) return storedWorkspaceId;
  if (!tenantContextEnabled()) {
    const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length === 1) return rows[0].id;
  }
  throw new Error("Newsletter ownership must be configured before generation.");
}
