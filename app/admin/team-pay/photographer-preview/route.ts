import { readStudioPayActor } from "@/lib/studio-team-pay-actor";
import { createStudioPayBridge } from "@/lib/studio-team-pay-bridge";
import { handleStudioPhotographerPreview } from "@/lib/studio-team-pay-photographer-preview";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 45;
export const runtime = "nodejs";

function photographerPreview(request: Request) {
  return handleStudioPhotographerPreview(request, {
    readActor: readStudioPayActor,
    bridge: createStudioPayBridge(),
    async audit({actor, memberId, section, weekStart}) {
      // Mandatory durable event; unlike the generic best-effort logger, throws on failure.
      await prisma.auditEvent.create({data:{
        actorId:actor.userId, action:"TEAM_PORTAL_PHOTOGRAPHER_VIEW",
        entityType:"PortalPhotographer", entityId:memberId, summary:"Read-only photographer view opened.",
        metadata:{section,weekStart},
      },select:{id:true}});
    },
  });
}
export { photographerPreview as GET, photographerPreview as HEAD };
