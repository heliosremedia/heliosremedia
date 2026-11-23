import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Actor } from "./studio-team-pay-bridge.ts";
import { designatedPayrollRole } from "./studio-team-pay-recipients.ts";

/** Both Studio entry points resolve and re-check the same active, designated payroll identity. */
export async function readStudioPayActor(): Promise<Actor | null> {
  const session = await getAdminSession();
  if (!session) return null;
  const workspaceId = process.env.TEAM_PAY_WORKSPACE_ID;
  // An authenticated but unauthorized user should get a denial, not a new login prompt.
  const deny = { userId: session.userId, role: "DENY", email: session.email };
  if (!workspaceId || session.workspaceId !== workspaceId || !["OWNER", "ADMIN"].includes(session.role)) return deny;
  const user = await prisma.adminUser.findFirst({
    where: { id: session.userId, workspaceId, active: true, state: "ACTIVE", sessionVersion: session.sessionVersion, role: { in: ["OWNER", "ADMIN"] } },
    select: { id: true, email: true, role: true },
  });
  return user && designatedPayrollRole(user.id,user.role,process.env.TEAM_PAY_OWNER_USER_ID,process.env.TEAM_PAY_ADMIN_USER_IDS)
    ? { userId:user.id, email:user.email, role:user.role } : deny;
}
