import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

// The existing HDPhotoHub and email configuration belongs to the legacy
// installation. Do not use it for another company or infer a provider mapping.
export async function canUseLegacyPortalProvider(workspaceId: string) {
  if (tenantContextEnabled()) return false;
  const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
  return rows.length === 1 && rows[0].id === workspaceId;
}
