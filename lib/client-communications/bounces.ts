import "server-only";

import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  BOUNCED_BACK_GROUP_NAME,
  bouncedBackNormalizedGroupName,
  bouncedBackSystemKey,
  normalizeBounceEmail,
  providerRecipientMatches,
  sanitizeBounceReason,
} from "./bounce-core";

export type ResendBouncePayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: unknown;
    bounce?: { type?: string; subtype?: string; message?: string };
  };
};

function occurredAt(value: unknown) {
  const date = typeof value === "string" ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function isPermanentBounce(event: ResendBouncePayload) {
  return event.type === "email.bounced" &&
    (event.data?.bounce?.type ?? "").trim().toLowerCase() === "permanent";
}

export async function recordRetryableBounceFailure(providerEventId: string, error: unknown) {
  await prisma.resendWebhookEvent.updateMany({
    where: { providerEventId, processingStatus: "PROCESSING" },
    data: {
      processingStatus: "FAILED_RETRYABLE",
      reason: sanitizeBounceReason(error instanceof Error ? error.message : "Retryable processing failure"),
      processedAt: new Date(),
    },
  });
}

export async function processPermanentBounce(providerEventId: string, event: ResendBouncePayload) {
  const providerMessageId = event.data?.email_id?.trim() || null;
  const eventOccurredAt = occurredAt(event.created_at);
  const bounceType = event.data?.bounce?.type?.trim() || null;
  const bounceSubtype = event.data?.bounce?.subtype?.trim() || null;
  const reason = sanitizeBounceReason(event.data?.bounce?.message ?? bounceSubtype ?? bounceType);

  try {
    await prisma.resendWebhookEvent.create({
      data: {
        providerEventId,
        providerMessageId,
        eventType: event.type || "email.bounced",
        processingStatus: "PROCESSING",
        bounceType,
        bounceSubtype,
        reason,
        occurredAt: eventOccurredAt,
      },
    });
  } catch {
    const retry = await prisma.resendWebhookEvent.updateMany({
      where: { providerEventId, processingStatus: "FAILED_RETRYABLE" },
      data: { processingStatus: "PROCESSING", processedAt: null },
    });
    if (!retry.count) return { status: "duplicate" as const };
  }

  if (!isPermanentBounce(event)) {
    await prisma.resendWebhookEvent.update({
      where: { providerEventId },
      data: { processingStatus: "IGNORED_NON_PERMANENT", processedAt: new Date() },
    });
    return { status: "ignored" as const };
  }
  if (!providerMessageId) {
    await prisma.resendWebhookEvent.update({
      where: { providerEventId },
      data: { processingStatus: "REJECTED_MISSING_MESSAGE_ID", processedAt: new Date() },
    });
    return { status: "rejected" as const };
  }

  try {
    const matches = await prisma.campaignRecipient.findMany({
      where: { providerMessageId },
      select: {
        id: true,
        clientId: true,
        email: true,
        campaign: { select: { createdBy: { select: { workspaceId: true } } } },
      },
      take: 2,
    });
    if (matches.length !== 1) {
      await prisma.resendWebhookEvent.update({
        where: { providerEventId },
        data: {
          processingStatus: matches.length ? "REJECTED_AMBIGUOUS_OWNER" : "REJECTED_OWNER_NOT_FOUND",
          processedAt: new Date(),
        },
      });
      return { status: "rejected" as const };
    }
    const recipient = matches[0];
    const normalizedEmail = normalizeBounceEmail(recipient.email);
    if (!normalizedEmail || !providerRecipientMatches(event.data?.to, normalizedEmail)) {
      await prisma.resendWebhookEvent.update({
        where: { providerEventId },
        data: { processingStatus: "REJECTED_RECIPIENT_MISMATCH", processedAt: new Date() },
      });
      return { status: "rejected" as const };
    }
    const workspaceId = recipient.campaign.createdBy.workspaceId;
    const newer = await prisma.resendWebhookEvent.findFirst({
      where: {
        campaignRecipientId: recipient.id,
        processingStatus: "PROCESSED",
        occurredAt: { gt: eventOccurredAt },
      },
      select: { id: true },
    });
    if (newer) {
      await prisma.resendWebhookEvent.update({
        where: { providerEventId },
        data: {
          workspaceId,
          clientId: recipient.clientId,
          campaignRecipientId: recipient.id,
          normalizedEmail,
          processingStatus: "IGNORED_OUT_OF_ORDER",
          processedAt: new Date(),
        },
      });
      return { status: "ignored" as const };
    }

    const systemKey = bouncedBackSystemKey(workspaceId);
    const group = await prisma.communicationGroup.upsert({
      where: { systemKey },
      create: {
        name: BOUNCED_BACK_GROUP_NAME,
        normalizedName: bouncedBackNormalizedGroupName(workspaceId),
        systemKey,
        systemManaged: true,
      },
      update: { name: BOUNCED_BACK_GROUP_NAME, systemManaged: true },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.communicationGroupMembership.createMany({
        data: [{ groupId: group.id, clientId: recipient.clientId }],
        skipDuplicates: true,
      }),
      prisma.resendWebhookEvent.update({
        where: { providerEventId },
        data: {
          workspaceId,
          clientId: recipient.clientId,
          campaignRecipientId: recipient.id,
          normalizedEmail,
          processingStatus: "PROCESSED",
          processedAt: new Date(),
        },
      }),
    ]);
    await recordAuditEvent({
      action: "CLIENT_PERMANENT_BOUNCE_RECORDED",
      entityType: "CommunicationClient",
      entityId: recipient.clientId,
      summary: `A permanent delivery failure added ${normalizedEmail} to Bounced Back.`,
      metadata: { providerEventId, providerMessageId, workspaceId, bounceType, bounceSubtype, reason },
    });
    return { status: "processed" as const, workspaceId, clientId: recipient.clientId };
  } catch (error) {
    await recordRetryableBounceFailure(providerEventId, error);
    throw error;
  }
}
