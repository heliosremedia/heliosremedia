import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import type { Prisma } from "@/app/generated/prisma/client";

/** Server-supplied workspace only. Legacy rows are excluded in tenant mode. */
export async function getContentOwnershipScope(workspaceId: string, client: Pick<Prisma.TransactionClient, "workspace"> = prisma) {
  if (!workspaceId) throw new Error("Content workspace is required.");
  if (!tenantContextEnabled()) {
    const rows = await client.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length === 1 && rows[0].id === workspaceId) {
      return { OR: [{ workspaceId }, { workspaceId: null }] };
    }
  }
  return { workspaceId };
}

export const getBlogOwnershipScope = getContentOwnershipScope;
