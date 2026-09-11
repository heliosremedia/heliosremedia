import "server-only";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

export async function resolveCampaignWorkspace(storedWorkspaceId: string | null) {
  if (storedWorkspaceId) return storedWorkspaceId;
  if (!tenantContextEnabled()) {
    const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length === 1) return rows[0].id;
  }
  throw new Error("Campaign ownership must be configured before delivery.");
}

// Keep unfinished sender, consent, webhook and upload paths single-company.
export async function getCampaignAdminSession() {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return null;
  const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
  return rows.length === 1 && rows[0].id === session.workspaceId ? session : null;
}
