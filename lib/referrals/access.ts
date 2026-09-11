import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

import type { AdminSession } from "@/lib/auth/session";
import { getAdminSession } from "@/lib/auth/session";
import { requireReferralStudioEnabled } from "./config";
import { isReferralAdministrator } from "./permissions";

export async function getReferralAdminSession() {
  requireReferralStudioEnabled();
  const session = await getAdminSession();
  if (!session || !isReferralAdministrator(session.role) || tenantContextEnabled()) return null;
  // Referral roots and delivery still need stored ownership before tenant use.
  const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
  return rows.length === 1 && rows[0].id === session.workspaceId ? session : null;
}

export function assertReferralAdmin(session: AdminSession | null) {
  if (!session || !isReferralAdministrator(session.role)) {
    throw new Error("REFERRAL_ADMIN_REQUIRED");
  }
  return session;
}
