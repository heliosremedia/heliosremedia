import "server-only";
import { randomUUID } from "node:crypto";
import { bouncedBackSystemKey } from "@/lib/client-communications/bounce-core";
import { prisma } from "@/lib/prisma";
import { addressIsMarketingEligible, createPreferenceToken } from "@/lib/client-communications/preferences";
import { sendEmail } from "@/lib/client-communications/providers/resend";
import { getSiteUrl } from "@/lib/site";
import { decrypt, encrypt, stageTargets } from "./core";
import { replayDecision, dispatchOpen } from "./policy";
import { renderEventEmail } from "./email";

export async function processEventDeliveries() {
  const now = new Date();
  const deadline = Date.now() + 240_000;
  const recipientLimit = 100;
  const due = await prisma.eventDelivery.findMany({where:{status:"SCHEDULED",scheduledAt:{lte:now}},orderBy:{scheduledAt:"asc"},take:10,include:{event:true}});
  let sent = 0; let processed = 0;
  for (const delivery of due) {
    if (!dispatchOpen({eventStatus:delivery.event.status,deliveryStatus:delivery.status,startsAt:delivery.event.startsAt,scheduledAt:delivery.scheduledAt},+now)) {
      await prisma.eventDelivery.update({where:{id:delivery.id},data:{status:"CANCELLED"}}); continue;
    }
    const invitations = await prisma.eventInvitation.findMany({where:{eventId:delivery.eventId},select:{id:true}});
    const started = await prisma.$transaction(async tx => {
      const locked = await tx.eventInvitationEvent.updateMany({where:{id:delivery.eventId,status:"SCHEDULED",startsAt:{gt:new Date()}},data:{updatedAt:new Date()}});
      if (!locked.count) return false;
      const fresh = await tx.eventDelivery.findUnique({where:{id:delivery.id}});
      if (!fresh || fresh.status !== "SCHEDULED" || fresh.scheduledAt > new Date()) return false;
      await tx.eventDeliveryMessage.createMany({data:invitations.map(i => ({deliveryId:delivery.id,invitationId:i.id})),skipDuplicates:true});
      return true;
    });
    if (!started) continue;
    const staleBefore = new Date(Date.now()-5*60_000);
    const messages = await prisma.eventDeliveryMessage.findMany({where:{deliveryId:delivery.id,OR:[{status:"PENDING"},{status:"SENDING",claimedAt:{lt:staleBefore}}]},orderBy:{id:"asc"},take:Math.max(0,recipientLimit-processed)});
    for (const message of messages) {
      if (Date.now() >= deadline) break;
      processed++;
      const claimId = randomUUID();
      const claim = await prisma.eventDeliveryMessage.updateMany({where:{id:message.id,OR:[{status:"PENDING"},{status:"SENDING",claimedAt:{lt:staleBefore}}]},data:{status:"SENDING",claimId,claimedAt:new Date(),attempts:{increment:1}}});
      if (!claim.count) continue;
      const finish = async (status:string,error?:string,providerMessageId?:string) => prisma.eventDeliveryMessage.updateMany({where:{id:message.id,claimId},data:{status,error:error || null,providerMessageId,sentAt:status === "SENT" ? new Date() : undefined}});
      // Resend retains idempotency keys for 24h. Never replay an uncertain attempt beyond 20h.
      if (replayDecision(message) === "UNCERTAIN") { await finish("UNCERTAIN","Provider outcome needs manual reconciliation; automatic resend is disabled."); continue; }
      try {
        const current = await prisma.eventInvitation.findUnique({where:{id:message.invitationId},include:{event:true}});
        const activeDelivery = await prisma.eventDelivery.findUnique({where:{id:delivery.id}});
        const client = current ? await prisma.communicationClient.findFirst({where:{id:current.clientId,workspaceMemberships:{some:{workspaceId:current.event.workspaceId}},archivedAt:null,emailSubscribed:true,emailStatus:"VALID",groupMemberships:{none:{group:{systemKey:bouncedBackSystemKey(current.event.workspaceId)}}}}}) : null;
        if (!current || current.event.status !== "SCHEDULED" || current.event.startsAt <= new Date() || activeDelivery?.status !== "SCHEDULED" || activeDelivery.scheduledAt > new Date() || !stageTargets(delivery.stage,current.response) || !client || client.normalizedEmail !== current.email || !await addressIsMarketingEligible(current.email)) { await finish("SKIPPED","Recipient no longer eligible, response changed, or event closed."); continue; }
        if (delivery.stage !== "INITIAL" && !await prisma.eventDeliveryMessage.findFirst({where:{invitationId:current.id,status:"SENT",delivery:{stage:"INITIAL"}}})) {
          const initial = await prisma.eventDelivery.findUnique({where:{eventId_stage:{eventId:current.eventId,stage:"INITIAL"}}});
          if (initial?.status === "SCHEDULED") {
            await prisma.eventDeliveryMessage.updateMany({where:{id:message.id,claimId},data:{status:"PENDING",attempts:{decrement:1},error:"Waiting for initial invitation delivery."}});
          } else await finish("SKIPPED","Initial invitation was not sent.");
          continue;
        }
        let payload: {to:string;subject:string;html:string;unsubscribeUrl:string};
        const secret = process.env.AUTH_SECRET || "";
        if (message.encryptedPayload) payload = JSON.parse(decrypt(message.encryptedPayload,secret));
        else {
          const unsubscribeToken = await createPreferenceToken({clientId:client.id});
          payload = {to:current.email,...renderEventEmail(current.event,delivery.stage,decrypt(current.encryptedToken,secret),unsubscribeToken,{recipientFirstName:client.firstName}),unsubscribeUrl:`${getSiteUrl()}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`};
          await prisma.eventDeliveryMessage.updateMany({where:{id:message.id,claimId},data:{encryptedPayload:encrypt(JSON.stringify(payload),secret)}});
        }
        // Persist before provider call so a crash/timeout retains the same content and key.
        if (!message.firstAttemptAt) await prisma.eventDeliveryMessage.updateMany({where:{id:message.id,claimId},data:{firstAttemptAt:new Date()}});
        const finalDelivery = await prisma.eventDelivery.findUnique({where:{id:delivery.id},include:{event:{select:{status:true}}}});
        if (finalDelivery?.status !== "SCHEDULED" || finalDelivery.scheduledAt > new Date() || finalDelivery.event.status !== "SCHEDULED") { await finish("SKIPPED","Cancelled before send."); continue; }
        const result = await sendEmail({...payload,source:"campaign",operationId:delivery.id,idempotencyKey:`event-message-${message.id}`,singleAttempt:true});
        await finish("SENT",undefined,result.messageId); sent++;
      } catch {
        // Keep the frozen payload and provider key. Retry only after lease expiry.
        await prisma.eventDeliveryMessage.updateMany({where:{id:message.id,claimId},data:{error:"Delivery could not be confirmed. Retrying safely with the same provider key."}});
      }
    }
    const outstanding = await prisma.eventDeliveryMessage.count({where:{deliveryId:delivery.id,status:{in:["PENDING","SENDING"]}}});
    if (!outstanding) {
      const uncertain = await prisma.eventDeliveryMessage.count({where:{deliveryId:delivery.id,status:{in:["UNCERTAIN","FAILED"]}}});
      await prisma.eventDelivery.updateMany({where:{id:delivery.id,status:"SCHEDULED"},data:{status:uncertain ? "FAILED" : "COMPLETED"}});
    }
    if (processed >= recipientLimit || Date.now() >= deadline) break;
  }
  return {processed,sent};
}
