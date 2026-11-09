import "server-only";
import { prisma } from "@/lib/prisma";
import { setMarketingPreference } from "@/lib/client-communications/preferences";
import { providerRecipientMatches, bouncedBackSystemKey, bouncedBackNormalizedGroupName } from "@/lib/client-communications/bounce-core";
export async function processEventWebhook(providerEventId:string, providerMessageId:string, status:string, recipients:unknown, bounceType?:string) {
  const messages = await prisma.eventDeliveryMessage.findMany({where:{providerMessageId},take:2,include:{invitation:true,delivery:{include:{event:true}}}});
  if (!messages.length) return false;
  if (messages.length !== 1) throw new Error("Ambiguous event provider message.");
  const message = messages[0]; const email = message.invitation.email;
  if (!providerRecipientMatches(recipients,email)) throw new Error("Event webhook recipient mismatch.");
  const permanent = status === "BOUNCED" && bounceType?.trim().toLowerCase() === "permanent";
  const complaint = status === "COMPLAINED";
  if (permanent || complaint || status === "SUPPRESSED") {
    const reason = complaint ? "COMPLAINT" : permanent ? "PERMANENT_BOUNCE" : "PROVIDER_SUPPRESSED";
    await prisma.$transaction([
      prisma.communicationClient.updateMany({where:{normalizedEmail:email},data:{emailStatus:complaint ? "COMPLAINED" : "BOUNCED",emailStatusUpdatedAt:new Date()}}),
      prisma.communicationSuppression.upsert({where:{providerEventId},create:{providerEventId,normalizedEmail:email,reason,provider:"RESEND",clientId:message.invitation.clientId},update:{releasedAt:null,reason}}),
    ]);
    await setMarketingPreference({email,status:complaint ? "UNSUBSCRIBED" : "SUPPRESSED",source:"RESEND_WEBHOOK",reason,messageId:providerMessageId});
    if (permanent) {
      const workspaceId = message.delivery.event.workspaceId;
      const group = await prisma.communicationGroup.upsert({where:{systemKey:bouncedBackSystemKey(workspaceId)},create:{name:"Bounced Back",normalizedName:bouncedBackNormalizedGroupName(workspaceId),systemKey:bouncedBackSystemKey(workspaceId),systemManaged:true},update:{},select:{id:true}});
      await prisma.communicationGroupMembership.createMany({data:[{groupId:group.id,clientId:message.invitation.clientId}],skipDuplicates:true});
    }
  }
  await prisma.resendWebhookEvent.update({where:{providerEventId},data:{workspaceId:message.delivery.event.workspaceId,clientId:message.invitation.clientId,normalizedEmail:email,processingStatus:"PROCESSED",processedAt:new Date()}});
  return true;
}
