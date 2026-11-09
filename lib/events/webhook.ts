import "server-only";
import { PermanentWebhookError } from "@/lib/client-communications/resend-webhook-core";
import { prisma } from "@/lib/prisma";
import { setMarketingPreference } from "@/lib/client-communications/preferences";
import { providerRecipientMatches, bouncedBackSystemKey, bouncedBackNormalizedGroupName } from "@/lib/client-communications/bounce-core";
export async function processEventWebhook(providerEventId:string, providerMessageId:string, status:string, recipients:unknown, bounceType?:string) {
  const messages = await prisma.eventDeliveryMessage.findMany({where:{providerMessageId},take:2,include:{invitation:true,delivery:{include:{event:true}}}});
  const monthly = await prisma.monthlySummaryAttempt.findUnique({where:{providerMessageId},select:{recipientEmail:true,kind:true,report:{select:{workspaceId:true,clientId:true,recipientEmail:true}}}});
  if (!messages.length && !monthly) return false;
  if (messages.length + (monthly ? 1 : 0) !== 1) throw new PermanentWebhookError("Ambiguous event/monthly provider message.");
  const message = messages[0];
  const email = (message ? message.invitation.email : monthly!.recipientEmail).trim().toLowerCase();
  const workspaceId = message ? message.delivery.event.workspaceId : monthly!.report.workspaceId;
  // Test summaries are sent to an internal address, not the report's client.
  const clientId = message ? message.invitation.clientId : monthly!.kind !== "TEST" && monthly!.report.recipientEmail.trim().toLowerCase() === email ? monthly!.report.clientId : null;
  if (!providerRecipientMatches(recipients,email)) throw new PermanentWebhookError("Stored webhook recipient mismatch.");
  if (monthly?.kind === "TEST") {
    await prisma.resendWebhookEvent.update({where:{providerEventId},data:{workspaceId,clientId:null,normalizedEmail:email,processingStatus:"PROCESSED_TEST",processedAt:new Date()}});
    return true;
  }
  if (monthly && !clientId) throw new PermanentWebhookError("Monthly recipient snapshot mismatch.");
  const permanent = status === "BOUNCED" && bounceType?.trim().toLowerCase() === "permanent";
  const complaint = status === "COMPLAINED";
  if (permanent || complaint || status === "SUPPRESSED") {
    const reason = complaint ? "COMPLAINT" : permanent ? "PERMANENT_BOUNCE" : "PROVIDER_SUPPRESSED";
    await prisma.$transaction([
      prisma.communicationClient.updateMany({where:{normalizedEmail:email},data:{emailStatus:complaint ? "COMPLAINED" : "BOUNCED",emailStatusUpdatedAt:new Date()}}),
      prisma.communicationSuppression.upsert({where:{providerEventId},create:{providerEventId,normalizedEmail:email,reason,provider:"RESEND",clientId},update:{releasedAt:null,reason}}),
    ]);
    await setMarketingPreference({email,status:complaint ? "UNSUBSCRIBED" : "SUPPRESSED",source:"RESEND_WEBHOOK",reason,messageId:providerMessageId});
    if (permanent && clientId) {
      const group = await prisma.communicationGroup.upsert({where:{systemKey:bouncedBackSystemKey(workspaceId)},create:{name:"Bounced Back",normalizedName:bouncedBackNormalizedGroupName(workspaceId),systemKey:bouncedBackSystemKey(workspaceId),systemManaged:true},update:{},select:{id:true}});
      await prisma.communicationGroupMembership.createMany({data:[{groupId:group.id,clientId}],skipDuplicates:true});
    }
  }
  await prisma.resendWebhookEvent.update({where:{providerEventId},data:{workspaceId,clientId,normalizedEmail:email,processingStatus:"PROCESSED",processedAt:new Date()}});
  return true;
}
