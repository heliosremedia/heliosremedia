import "server-only";
import { bouncedBackSystemKey } from "@/lib/client-communications/bounce-core";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { addressIsMarketingEligible } from "@/lib/client-communications/preferences";
import { recordAuditEvent } from "@/lib/audit";
import { safeEventImageUrl } from "./themes";
import { STAGES, defaultSchedule, encrypt, newToken, tokenHash } from "./core";

export async function eventAdmin() {
  const session = await getAdminSession();
  if (!session || !["OWNER","ADMIN"].includes(session.role)) throw new Error("Administrator access required.");
  return session;
}
export const eventInclude = { invitations: { select: {id:true,clientId:true,email:true,displayName:true,response:true,additionalGuests:true,respondedAt:true} }, deliveries: { include: { messages: {select:{id:true,invitationId:true,status:true,providerMessageId:true,error:true,sentAt:true}} } } } as const;
export async function getEvent(id: string, workspaceId: string) {
  const event = await prisma.eventInvitationEvent.findFirst({where:{id,workspaceId},include:eventInclude});
  if (!event) throw new Error("Event not found."); return event;
}
export async function eventOptions(workspaceId: string) {
  const clients = await prisma.communicationClient.findMany({where:{workspaceMemberships:{some:{workspaceId}},archivedAt:null},select:{id:true,displayName:true,email:true},orderBy:{displayName:"asc"},take:5000});
  const groups = await prisma.communicationGroup.findMany({where:{memberships:{some:{client:{workspaceMemberships:{some:{workspaceId}}}}}},select:{id:true,name:true},orderBy:{name:"asc"}});
  return {clients,groups};
}
export async function auditEvent(session: Awaited<ReturnType<typeof eventAdmin>>, id: string, action: string) {
  await recordAuditEvent({actorId:session.userId,actorEmail:session.email,action:`EVENT_${action}`,entityType:"EventInvitationEvent",entityId:id,summary:`Event invitation ${action.toLowerCase()}.`});
}
export async function unscheduleEvent(id: string, workspaceId: string) {
  await prisma.$transaction(async tx => {
    // The processor acquires this same row lock before creating any messages.
    const locked = await tx.eventInvitationEvent.updateMany({where:{id,workspaceId,status:"SCHEDULED"},data:{updatedAt:new Date()}});
    if (!locked.count) throw new Error("Only scheduled events can be unscheduled.");
    if (await tx.eventDeliveryMessage.count({where:{delivery:{eventId:id}}})) throw new Error("Delivery has already started. This event cannot be unscheduled or edited.");
    const fresh = await tx.eventInvitationEvent.findFirst({where:{id,workspaceId},include:{deliveries:true}});
    if (!fresh?.deliveries.some(delivery => delivery.stage === "INITIAL" && delivery.status === "SCHEDULED") || fresh.deliveries.some(delivery => delivery.status === "SCHEDULED" && !STAGES.includes(delivery.stage as typeof STAGES[number]))) throw new Error("Only an untouched initial invitation schedule can be unscheduled.");
    await tx.eventDelivery.updateMany({where:{eventId:id,status:"SCHEDULED"},data:{status:"PAUSED"}});
    await tx.eventInvitationEvent.updateMany({where:{id,workspaceId},data:{status:"DRAFT"}});
  });
  return getEvent(id,workspaceId);
}

export async function scheduleEvent(id: string, workspaceId: string, stage: string, scheduledAt: Date, deliveryTimes?: unknown) {
  if (!Number.isFinite(+scheduledAt) || +scheduledAt < Date.now()+60000) throw new Error("Choose a delivery time at least one minute ahead.");
  const event = await getEvent(id,workspaceId);
  if (event.status === "CANCELLED" || scheduledAt >= event.startsAt) throw new Error("Event is cancelled or delivery is after its start.");
  if (!STAGES.includes(stage as typeof STAGES[number])) throw new Error("Choose an email stage.");
  const paused = event.deliveries.filter(delivery => delivery.status === "PAUSED");
  const resuming = stage === "INITIAL" && paused.length > 0;
  let schedule = stage === "INITIAL" ? defaultSchedule(scheduledAt,event.startsAt) : [{stage,scheduledAt}];
  if (deliveryTimes !== undefined && !resuming) throw new Error("Saved delivery times can only be changed for an unscheduled event.");
  if (resuming) {
    if (!paused.some(delivery => delivery.stage === "INITIAL") || !event.invitations.length) throw new Error("The saved invitation schedule is incomplete.");
    if (deliveryTimes !== undefined && (!deliveryTimes || typeof deliveryTimes !== "object" || Array.isArray(deliveryTimes))) throw new Error("Enter all saved delivery times.");
    const times = deliveryTimes as Record<string, unknown> | undefined;
    if (times && (Object.keys(times).length !== paused.length || Object.keys(times).some(key => !paused.some(delivery => delivery.stage === key)))) throw new Error("Provide exactly the saved delivery stages.");
    schedule = paused.map(delivery => {
      const value = times?.[delivery.stage];
      if (times && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))) throw new Error("Enter a valid delivery time for every saved stage.");
      const date = times ? new Date(value as string) : delivery.stage === "INITIAL" ? scheduledAt : delivery.scheduledAt;
      if (!Number.isFinite(+date) || +date < Date.now()+60000 || date >= event.startsAt) throw new Error("Every delivery must be at least one minute ahead and before the event starts.");
      if (times && date.toISOString() !== (value as string).replace(/Z$/, (value as string).includes(".") ? "Z" : ".000Z")) throw new Error("Choose a valid delivery date.");
      return {stage:delivery.stage,scheduledAt:date};
    }).sort((a,b) => STAGES.indexOf(a.stage as typeof STAGES[number])-STAGES.indexOf(b.stage as typeof STAGES[number]));
    if (+schedule[0].scheduledAt !== +scheduledAt || schedule.some((entry,index) => !STAGES.includes(entry.stage as typeof STAGES[number]) || (index > 0 && entry.scheduledAt <= schedule[index-1].scheduledAt))) throw new Error("Delivery times must match the initial time and follow initial, follow-up, reminder order.");
  }
  if (stage !== "INITIAL" && event.status !== "SCHEDULED") throw new Error("Schedule the initial invitation first.");
  if (stage === "INITIAL" && event.status !== "DRAFT") throw new Error("Initial invitations have already been scheduled.");
  if (stage !== "INITIAL") {
    const initial = event.deliveries.find(delivery => delivery.stage === "INITIAL");
    if (!initial || initial.status === "CANCELLED" || scheduledAt <= initial.scheduledAt) throw new Error("Follow-up and reminder delivery must be after the initial invitation.");
  }
  const candidates = stage === "INITIAL" && !resuming ? await prisma.communicationClient.findMany({where:{workspaceMemberships:{some:{workspaceId}},emailSubscribed:true,emailStatus:"VALID",archivedAt:null,...(event.mode === "INDIVIDUALS" ? {id:{in:event.clientIds}} : {}),groupMemberships:{none:{group:{systemKey:bouncedBackSystemKey(workspaceId)}},...(event.mode === "GROUPS" ? {some:{groupId:{in:event.groupIds}}} : {})}},orderBy:{id:"asc"}}) : [];
  const eligible = [];
  const emails = new Set<string>();
  for (const client of candidates) if (!emails.has(client.normalizedEmail) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.normalizedEmail) && await addressIsMarketingEligible(client.normalizedEmail)) { eligible.push(client); emails.add(client.normalizedEmail); }
  if (stage === "INITIAL" && !resuming && (!eligible.length || eligible.length > 1000)) throw new Error("Select between 1 and 1,000 eligible subscribed recipients.");
  const secret = process.env.AUTH_SECRET || "";
  const invitations = eligible.map(client => { const token = newToken(); return {eventId:id,clientId:client.id,email:client.normalizedEmail,displayName:client.displayName,tokenHash:tokenHash(token),encryptedToken:encrypt(token,secret)}; });
  await prisma.$transaction(async tx => {
    // Conditional update serializes scheduling against cancellation and draft edits.
    const locked = await tx.eventInvitationEvent.updateMany({where:{id,workspaceId,status:stage === "INITIAL" ? "DRAFT" : "SCHEDULED",updatedAt:event.updatedAt},data:{status:"SCHEDULED",updatedAt:new Date()}});
    if (!locked.count) throw new Error("Event changed. Reload before scheduling.");
    if (stage === "INITIAL" && await tx.eventDeliveryMessage.count({where:{delivery:{eventId:id}}})) throw new Error("Delivery has already started. This event cannot be rescheduled.");
    if (invitations.length) await tx.eventInvitation.createMany({data:invitations});
    for (const entry of schedule) {
      const existing = await tx.eventDelivery.findUnique({where:{eventId_stage:{eventId:id,stage:entry.stage}}});
      if (existing) {
        if ((existing.status !== "SCHEDULED" && !(resuming && existing.status === "PAUSED")) || await tx.eventDeliveryMessage.count({where:{deliveryId:existing.id}})) throw new Error("This delivery has already started or was cancelled.");
        await tx.eventDelivery.update({where:{id:existing.id},data:{scheduledAt:entry.scheduledAt,status:"SCHEDULED"}});
      } else await tx.eventDelivery.create({data:{eventId:id,...entry}});
    }
  });
  return getEvent(id,workspaceId);
}
export async function cancelEvent(id: string, workspaceId: string, stage?: string) {
  await prisma.$transaction(async tx => {
    const locked = await tx.eventInvitationEvent.updateMany({where:{id,workspaceId},data:stage ? {updatedAt:new Date()} : {status:"CANCELLED"}});
    if (!locked.count) throw new Error("Event not found.");
    await tx.eventDelivery.updateMany({where:{eventId:id,...(stage ? {stage} : {}),status:{in:["SCHEDULED","PAUSED"]}},data:{status:"CANCELLED"}});
    await tx.eventDeliveryMessage.updateMany({where:{delivery:{eventId:id,...(stage ? {stage} : {})},status:"PENDING"},data:{status:"SKIPPED",error:"Cancelled by administrator."}});
  });
  return getEvent(id,workspaceId);
}

/** Do not allow an administrator to attach a different workspace's private asset. */
export async function validateEventImageSelection(imageUrl: string | null, workspaceId: string) {
  if (!imageUrl) return;
  const base = process.env.R2_PUBLIC_URL;
  const safe = safeEventImageUrl(imageUrl, [base]);
  if (!safe || !base) throw new Error("Choose a JPEG or PNG from the image library, or upload an image.");
  const root = new URL(base).pathname.replace(/\/+$/, "");
  const storageKey = decodeURIComponent(new URL(safe).pathname.slice(root.length + 1));
  const workspace = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (new RegExp(`^events/${workspace}/[a-f0-9-]{36}\\.(?:jpg|png)$`).test(storageKey)) return;
  const media = await prisma.media.findFirst({ where: { storageKey, sourceType: "UPLOADED_IMAGE", mimeType: { in: ["image/jpeg", "image/png"] }, visibility: "VISIBLE", project: { workspaceId, status: "PUBLISHED", archivedAt: null } }, select: { id: true } });
  if (!media) throw new Error("Choose an image from this workspace's library, or upload an image.");
}
