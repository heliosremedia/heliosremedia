import { readStudioPayActor } from "@/lib/studio-team-pay-actor";
import { createStudioPayBridge, studioPaySinkCheckEnabled } from "@/lib/studio-team-pay-bridge";
import { handleStudioPayPreflight } from "@/lib/studio-team-pay-review";

export const dynamic = "force-dynamic";
export const maxDuration = 45;
export const runtime = "nodejs";

function preflight(request: Request) {
  return handleStudioPayPreflight(request, {
    readActor: readStudioPayActor,
    bridge: createStudioPayBridge(),
    sinkCheckEnabled: studioPaySinkCheckEnabled(process.env),
  });
}
export { preflight as GET, preflight as HEAD, preflight as POST };
