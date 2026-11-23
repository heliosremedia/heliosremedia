import { readStudioPayActor } from "@/lib/studio-team-pay-actor";
import { createStudioPayBridge } from "@/lib/studio-team-pay-bridge";
import { handleStudioPay } from "@/lib/studio-team-pay-review";

export const dynamic = "force-dynamic";
export const maxDuration = 45;
export const runtime = "nodejs";

function teamPay(request: Request) {
  return handleStudioPay(request, {
    readActor: readStudioPayActor,
    bridge: createStudioPayBridge(),
    writesEnabled: process.env.TEAM_PAY_WRITES_ENABLED === "true",
    activationWeek: process.env.TEAM_PAY_ACTIVATION_WEEK,
  });
}
export { teamPay as GET, teamPay as HEAD, teamPay as POST };
