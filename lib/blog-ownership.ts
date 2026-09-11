import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

/** Server-supplied workspace only. Legacy rows are excluded in tenant mode. */
export async function getContentOwnershipScope(workspaceId: string) {
  if (!workspaceId) throw new Error("Content workspace is required.");
  if (!tenantContextEnabled()) {
    const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length === 1 && rows[0].id === workspaceId) {
      return { OR: [{ workspaceId }, { workspaceId: null }] };
    }
  }
  return { workspaceId };
}

export const getBlogOwnershipScope = getContentOwnershipScope;
