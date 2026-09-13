import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import type { Prisma } from "@/app/generated/prisma/client";

export async function getWorkspaceSingletonTarget(workspaceId: string, client: Pick<Prisma.TransactionClient, "workspace"> = prisma) {
  if (!workspaceId) throw new Error("Settings workspace is required.");
  if (tenantContextEnabled()) {
    return { where: { workspaceId },
      createIdentity: { id: `workspace:${workspaceId}`, workspaceId } };
  }
  const rows = await client.workspace.findMany({ take: 2, select: { id: true } });
  if (rows.length !== 1 || rows[0].id !== workspaceId) throw new Error("Legacy settings require one matching workspace.");
  return { where: { id: "default", OR: [{ workspaceId }, { workspaceId: null }] },
    createIdentity: { id: "default", workspaceId } };
}
