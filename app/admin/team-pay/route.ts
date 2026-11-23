import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createStudioPayBridge, type Actor } from "@/lib/studio-team-pay-bridge";
import { handleStudioPay } from "@/lib/studio-team-pay-review";
import { designatedPayrollRole } from "@/lib/studio-team-pay-recipients";

export const dynamic = "force-dynamic";
export const maxDuration = 45;
export const runtime = "nodejs";

async function readActor(): Promise<Actor | null> {
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

function teamPay(request: Request) { return handleStudioPay(request, { readActor, bridge: createStudioPayBridge() }); }
export { teamPay as GET, teamPay as HEAD, teamPay as POST };
