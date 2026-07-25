import "server-only";

import type { AdminSession } from "@/lib/auth/session";
import { getAdminSession } from "@/lib/auth/session";
import { requireReferralStudioEnabled } from "./config";
import { isReferralAdministrator } from "./permissions";

export async function getReferralAdminSession() {
  requireReferralStudioEnabled();
  const session = await getAdminSession();
  return session && isReferralAdministrator(session.role) ? session : null;
}

export function assertReferralAdmin(session: AdminSession | null) {
  if (!session || !isReferralAdministrator(session.role)) {
    throw new Error("REFERRAL_ADMIN_REQUIRED");
  }
  return session;
}
