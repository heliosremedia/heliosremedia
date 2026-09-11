import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

// Preserve the existing sender/webhook implementation until company-specific
// destinations and verified senders are configured. Never send B's data to A.
export async function canUseLegacyInquiryNotifications(workspaceId: string) {
  if (tenantContextEnabled()) return false;
  const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
  return rows.length === 1 && rows[0].id === workspaceId;
}

export function inquiryAssigneeWhere(workspaceId: string) {
  return {
    active: true,
    workspaceId,
    ...(tenantContextEnabled() ? { workspaceMemberships: { some: { workspaceId, status: "ACTIVE" as const } } } : {}),
  };
}
