import "server-only";
import { prisma } from "@/lib/prisma";
import { bouncedBackSystemKey } from "@/lib/client-communications/bounce-core";
import { addressIsMarketingEligible } from "@/lib/client-communications/preferences";
import { getEvent } from "./service";
import { EventUpdateConflict, eventUpdateDate, eventUpdateInput, eventUpdateStage, eventUpdateTargets, isEventUpdateStage, type EventUpdateAudience, type EventUpdateCopy } from "./updates-core";

export async function eventUpdateAudienceCount(eventId: string, workspaceId: string, audience: EventUpdateAudience): Promise<number> {
  // The original frozen invitation roster is the maximum universe. Never query a new group/all-clients audience.
  const invitations = await prisma.eventInvitation.findMany({where:{eventId,event:{workspaceId},messages:{some:{status:"SENT",delivery:{stage:"INITIAL"}}}},select:{clientId:true,email:true,response:true}});
  const candidates = invitations.filter(invitation => eventUpdateTargets(audience,invitation.response));
  if (!candidates.length) return 0;
  const clients = await prisma.communicationClient.findMany({where:{id:{in:candidates.map(invitation => invitation.clientId)},workspaceMemberships:{some:{workspaceId}},archivedAt:null,emailSubscribed:true,emailStatus:"VALID",groupMemberships:{none:{group:{systemKey:bouncedBackSystemKey(workspaceId)}}}},select:{id:true,normalizedEmail:true}});
  const emails = new Map(clients.map(client => [client.id,client.normalizedEmail]));
  let count = 0;
  for (const invitation of candidates) if (emails.get(invitation.clientId) === invitation.email && await addressIsMarketingEligible(invitation.email)) count++;
  return count;
}

type SavedUpdate = { status: string; scheduledAt: Date; updateSubject: string | null; updateBody: string | null; updateAudience: string | null };
function verifyReplay(saved: SavedUpdate, copy: EventUpdateCopy, scheduledAt: Date) {
  if (saved.updateSubject !== copy.subject || saved.updateBody !== copy.body || saved.updateAudience !== copy.audience || +saved.scheduledAt !== +scheduledAt) throw new EventUpdateConflict("This update request was already used with different details. Review and create a new update.");
  if (saved.status === "CANCELLED") throw new EventUpdateConflict("This update was cancelled. Create a new update to schedule another email.");
}

export async function scheduleEventUpdate(eventId: string, workspaceId: string, input: Record<string, unknown>) {
  const copy = eventUpdateInput(input);
  const stage = eventUpdateStage(input.requestId);
  const scheduledAt = eventUpdateDate(input.scheduledAt);
  const event = await getEvent(eventId,workspaceId);
  const existing = event.deliveries.find(delivery => delivery.stage === stage);
  if (existing) { verifyReplay(existing,copy,scheduledAt); return {event,replayed:true}; }
  if (event.status !== "SCHEDULED" || event.startsAt <= new Date()) throw new Error("Only an active, scheduled event can receive an update.");
  if (+scheduledAt < Date.now()+60_000 || scheduledAt >= event.startsAt) throw new Error("Schedule the update at least one minute ahead and before the event starts.");
  const initial = event.deliveries.find(delivery => delivery.stage === "INITIAL");
  if (!initial || initial.status === "CANCELLED" || scheduledAt <= initial.scheduledAt) throw new Error("Schedule the update after the initial invitation.");
  if (!await eventUpdateAudienceCount(eventId,workspaceId,copy.audience)) throw new Error("No previously invited guests are currently eligible for this audience.");
  let replayed = false;
  await prisma.$transaction(async tx => {
    // The same event lock used by dispatch/cancellation serializes new updates without touching original deliveries.
    const locked = await tx.eventInvitationEvent.updateMany({where:{id:eventId,workspaceId,status:"SCHEDULED",updatedAt:event.updatedAt,startsAt:{gt:new Date()}},data:{updatedAt:new Date()}});
    const duplicate = await tx.eventDelivery.findUnique({where:{eventId_stage:{eventId,stage}}});
    if (duplicate) { verifyReplay(duplicate,copy,scheduledAt); replayed = true; return; }
    if (!locked.count) throw new EventUpdateConflict("Event changed. Reload before scheduling the update.");
    await tx.eventDelivery.create({data:{eventId,stage,scheduledAt,updateSubject:copy.subject,updateBody:copy.body,updateAudience:copy.audience}});
  });
  return {event:await getEvent(eventId,workspaceId),replayed};
}

export async function cancelEventUpdate(eventId: string, workspaceId: string, deliveryId: unknown) {
  if (typeof deliveryId !== "string" || !deliveryId || deliveryId.length > 100) throw new Error("Choose an event update to cancel.");
  await prisma.$transaction(async tx => {
    const locked = await tx.eventInvitationEvent.updateMany({where:{id:eventId,workspaceId},data:{updatedAt:new Date()}});
    if (!locked.count) throw new Error("Event not found.");
    const delivery = await tx.eventDelivery.findUnique({where:{id:deliveryId}});
    if (!delivery || delivery.eventId !== eventId || !isEventUpdateStage(delivery.stage)) throw new Error("Event update not found.");
    if (delivery.status !== "SCHEDULED" && delivery.status !== "CANCELLED") throw new Error("This update is no longer pending. Already accepted emails cannot be recalled.");
    await tx.eventDelivery.updateMany({where:{id:deliveryId,eventId,status:"SCHEDULED"},data:{status:"CANCELLED"}});
    await tx.eventDeliveryMessage.updateMany({where:{deliveryId,status:"PENDING"},data:{status:"SKIPPED",error:"Cancelled by administrator."}});
  });
  return getEvent(eventId,workspaceId);
}
