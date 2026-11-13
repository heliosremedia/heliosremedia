import "server-only";
import { prisma } from "@/lib/prisma";
import { bouncedBackSystemKey } from "@/lib/client-communications/bounce-core";
import { addressIsMarketingEligible } from "@/lib/client-communications/preferences";
import { getEvent } from "./service";
import { EventResendConflict, resendStage, resendUnavailable } from "./resend-core";

export async function queueInvitationResend(eventId: string, workspaceId: string, input: Record<string, unknown>) {
  const stage = resendStage(input.invitationId, input.requestId);
  const invitationId = input.invitationId as string;
  if (typeof input.recipientEmail !== "string" || input.recipientEmail.length > 254) throw new Error("Confirm the recipient's current email address.");
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  let replayed = false;
  await prisma.$transaction(async tx => {
    // Same event-row lock as schedule/cancel/dispatch; concurrent tabs cannot queue two resends.
    const locked = await tx.eventInvitationEvent.updateMany({where:{id:eventId,workspaceId},data:{updatedAt:new Date()}});
    if (!locked.count) throw new Error("Event not found.");
    const event = await tx.eventInvitationEvent.findFirst({where:{id:eventId,workspaceId},include:{deliveries:{include:{messages:true}}}});
    const invitation = await tx.eventInvitation.findFirst({where:{id:invitationId,eventId,event:{workspaceId}}});
    if (!event || !invitation) throw new Error("Invited guest not found.");
    if (invitation.email !== recipientEmail) throw new EventResendConflict("Recipient changed. Refresh and confirm the current address before resending.");
    const existing = event.deliveries.find(delivery => delivery.stage === stage);
    if (existing) { replayed = true; return; } // A lost response never creates or reactivates a delivery.
    const unavailable = resendUnavailable(event,invitationId);
    if (unavailable) throw new EventResendConflict(unavailable);
    const client = await tx.communicationClient.findFirst({where:{id:invitation.clientId,workspaceMemberships:{some:{workspaceId}},archivedAt:null,emailSubscribed:true,emailStatus:"VALID",groupMemberships:{none:{group:{systemKey:bouncedBackSystemKey(workspaceId)}}}}});
    if (!client || client.normalizedEmail !== invitation.email || !await addressIsMarketingEligible(invitation.email)) throw new Error("This guest is no longer eligible for marketing email. No resend was queued.");
    // The stage encodes the only permitted invitation. Dispatch also rechecks it and eligibility.
    await tx.eventDelivery.create({data:{eventId,stage,scheduledAt:new Date()}});
  });
  return {event:await getEvent(eventId,workspaceId),replayed};
}
