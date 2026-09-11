import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

// Temporary containment while sender/consent/publication paths are converted.
// A stored owner is never replaced by a creator's current account workspace.
export async function legacyReferralExecutionWorkspace(storedWorkspaceId: string | null) {
  if (tenantContextEnabled()) return null;
  const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
  if (rows.length !== 1 || (storedWorkspaceId && storedWorkspaceId !== rows[0].id)) return null;
  return rows[0].id;
}
