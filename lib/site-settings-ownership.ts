import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

export async function getSiteSettingsWriteTarget(workspaceId: string) {
  if (!workspaceId) throw new Error("Settings workspace is required.");
  if (tenantContextEnabled()) {
    return { where: { workspaceId } satisfies Prisma.SiteSettingsWhereUniqueInput,
      createIdentity: { id: `workspace:${workspaceId}`, workspaceId } };
  }
  const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
  if (rows.length !== 1 || rows[0].id !== workspaceId) throw new Error("Legacy settings require one matching workspace.");
  return { where: { id: "default", OR: [{ workspaceId }, { workspaceId: null }] } satisfies Prisma.SiteSettingsWhereUniqueInput,
    createIdentity: { id: "default", workspaceId } };
}
