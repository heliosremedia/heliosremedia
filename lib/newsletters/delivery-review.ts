import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { newsletterAcceptedCompletion, newsletterRecordedTotals, reviewNewsletterDelivery } from "./delivery-review-core";

async function readDeliveryEvidence(tx: Prisma.TransactionClient, editionId: string, workspaceId: string) {
    const edition = await tx.newsletterEdition.findFirst({
      where: { id: editionId, series: await getContentOwnershipScope(workspaceId) },
      select: { id: true, status: true, rowVersion: true, approvedRevisionId: true, delivery: {
        select: { campaignId: true, revisionId: true, campaign: { select: { workspaceId: true, rowVersion: true, recipientCount: true, sentCount: true, failedCount: true, recipients: {
          take: 5001, orderBy: { id: "asc" }, select: { id: true, status: true, providerMessageId: true, sentAt: true, _count: { select: { events: true, resendWebhookEvents: true } } },
        } } }, attempts: {
          where: { workspaceId: workspaceId }, take: 5001, orderBy: { createdAt: "asc" },
          select: { id: true, updatedAt: true, revisionId: true, status: true, recipientIds: true, providerReceiptIds: true },
        } },
      } },
    });
    if (!edition) return null;
    const delivery = edition.delivery;
    if (!delivery) return edition;
    const revision = await tx.newsletterRevision.findFirst({ where: { id: delivery.revisionId, editionId: edition.id }, select: { id: true } });
    const foreignAttempts = await tx.newsletterDeliveryAttempt.count({ where: { editionId: edition.id, workspaceId: { not: workspaceId } } });
    if (!revision || foreignAttempts || delivery.campaign.workspaceId !== workspaceId) throw new Error("NEWSLETTER_DELIVERY_OWNERSHIP_UNRESOLVED");
    if (delivery.campaign.recipients.length > 5000 || delivery.attempts.length > 5000) throw new Error("NEWSLETTER_DELIVERY_REVIEW_LIMIT");
    return edition;
}

export async function getNewsletterDeliveryReview(editionId: string, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const edition = await readDeliveryEvidence(tx, editionId, actor.workspaceId);
    if (!edition) return null;
    const delivery = edition.delivery;
    return { editionId: edition.id, editionStatus: edition.status, rowVersion: edition.rowVersion,
      delivery: delivery ? {
        ...reviewNewsletterDelivery({ revisionId: delivery.revisionId, recipients: delivery.campaign.recipients, attempts: delivery.attempts }),
        totals: { recorded: newsletterRecordedTotals(delivery.campaign.recipients), stored: {
          recipientCount: delivery.campaign.recipientCount, sentCount: delivery.campaign.sentCount, failedCount: delivery.campaign.failedCount,
        } },
      } : null,
    };
  }, { isolationLevel: "RepeatableRead" });
}

/** Repair stored recipient observations only; never resume the edition or call a provider. */
export async function repairNewsletterAcceptedRecords(editionId: string, expectedVersion: number, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const scope = await getContentOwnershipScope(actor.workspaceId);
    const legacyAllowed = "OR" in scope;
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT edition.id FROM "NewsletterEdition" edition JOIN "NewsletterSeries" series ON series.id = edition."seriesId"
      WHERE edition.id = ${editionId} AND edition."rowVersion" = ${expectedVersion}
        AND (series."workspaceId" = ${actor.workspaceId} OR (series."workspaceId" IS NULL AND ${legacyAllowed}))
      FOR UPDATE OF edition
    `;
    if (!locked.length) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
    const edition = await readDeliveryEvidence(tx, editionId, actor.workspaceId);
    if (!edition?.delivery || edition.rowVersion !== expectedVersion
      || !["SENDING", "SENT", "SEND_FAILED", "PARTIALLY_SENT"].includes(edition.status)) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
    const delivery = edition.delivery;
    const review = reviewNewsletterDelivery({ revisionId: delivery.revisionId, recipients: delivery.campaign.recipients, attempts: delivery.attempts });
    if (review.invalidAttempts) throw new Error("NEWSLETTER_DELIVERY_OWNERSHIP_UNRESOLVED");
    const repaired: string[] = [];
    const attemptIds = new Set<string>();
    for (const observation of review.recipients.filter(item => item.needsRecipientRecordRepair)) {
      const recipient = delivery.campaign.recipients.find(item => item.id === observation.recipientId)!;
      const attempt = delivery.attempts.find(item => item.status === "ACCEPTED" && Array.isArray(item.recipientIds) && item.recipientIds.includes(recipient.id))!;
      const ids = attempt.recipientIds as string[];
      const receiptId = (attempt.providerReceiptIds as string[])[ids.indexOf(recipient.id)];
      const updated = await tx.campaignRecipient.updateMany({
        where: { id: recipient.id, campaignId: delivery.campaignId, status: recipient.status, providerMessageId: recipient.providerMessageId, sentAt: recipient.sentAt, events: { none: {} }, resendWebhookEvents: { none: {} } },
        data: { status: "SENT", providerMessageId: receiptId, sentAt: recipient.sentAt ?? attempt.updatedAt },
      });
      if (updated.count !== 1) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
      repaired.push(recipient.id); attemptIds.add(attempt.id);
    }
    if (repaired.length) await tx.auditEvent.create({
      data: { workspaceId: actor.workspaceId, actorId: actor.userId, action: "NEWSLETTER_ACCEPTED_RECORDS_REPAIRED",
        entityType: "NewsletterEdition", entityId: edition.id,
        summary: "Reconciled recipient records against stored provider acceptance receipts. No email was sent.",
        metadata: { expectedVersion, recipientIds: repaired, attemptIds: [...attemptIds], providerCalled: false },
      },
    });
    return { repaired: repaired.length, editionStatus: edition.status, automaticRetryAllowed: false as const };
  }, { isolationLevel: "RepeatableRead" });
}


/** Reconcile aggregate record counts without changing any publication or delivery state. */
export async function reconcileNewsletterDeliveryTotals(editionId: string, expectedVersion: number, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const scope = await getContentOwnershipScope(actor.workspaceId);
    const legacyAllowed = "OR" in scope;
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT edition.id FROM "NewsletterEdition" edition JOIN "NewsletterSeries" series ON series.id = edition."seriesId"
      WHERE edition.id = ${editionId} AND edition."rowVersion" = ${expectedVersion}
        AND (series."workspaceId" = ${actor.workspaceId} OR (series."workspaceId" IS NULL AND ${legacyAllowed}))
      FOR UPDATE OF edition
    `;
    if (!locked.length) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
    const edition = await readDeliveryEvidence(tx, editionId, actor.workspaceId);
    if (!edition?.delivery || edition.rowVersion !== expectedVersion) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
    const delivery = edition.delivery;
    await tx.$queryRaw`SELECT id FROM "EmailCampaign" WHERE id = ${delivery.campaignId} AND "workspaceId" = ${actor.workspaceId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "CampaignRecipient" WHERE "campaignId" = ${delivery.campaignId} ORDER BY id FOR UPDATE`;
    if (await tx.newsletterJob.findFirst({ where: { editionId, status: "CLAIMED" }, select: { id: true } })) throw new Error("NEWSLETTER_DELIVERY_BUSY");
    const review = reviewNewsletterDelivery({ revisionId: delivery.revisionId, recipients: delivery.campaign.recipients, attempts: delivery.attempts });
    if (review.invalidAttempts || review.recipients.some(item => item.needsRecipientRecordRepair || ["UNCERTAIN", "RECEIPT_CONFLICT"].includes(item.observation))) {
      throw new Error("NEWSLETTER_DELIVERY_RECONCILIATION_REQUIRED");
    }
    const { recipientCount, sentCount, failedCount } = newsletterRecordedTotals(delivery.campaign.recipients);
    const previous = { recipientCount: delivery.campaign.recipientCount, sentCount: delivery.campaign.sentCount, failedCount: delivery.campaign.failedCount };
    const totals = { recipientCount, sentCount, failedCount };
    const changed = recipientCount !== previous.recipientCount || sentCount !== previous.sentCount || failedCount !== previous.failedCount;
    if (changed) {
      const updated = await tx.emailCampaign.updateMany({
        where: { id: delivery.campaignId, workspaceId: actor.workspaceId, rowVersion: delivery.campaign.rowVersion, ...previous },
        data: { ...totals, rowVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
      await tx.auditEvent.create({ data: {
        workspaceId: actor.workspaceId, actorId: actor.userId, action: "NEWSLETTER_DELIVERY_TOTALS_RECONCILED",
        entityType: "NewsletterEdition", entityId: edition.id,
        summary: "Reconciled campaign totals against recorded recipient states. No email was sent.",
        metadata: { expectedVersion, campaignId: delivery.campaignId, previous, totals, providerCalled: false },
      } });
    }
    return { changed, totals, editionStatus: edition.status, automaticRetryAllowed: false as const };
  }, { isolationLevel: "RepeatableRead" });
}


/** Close a fully accepted interrupted execution. This never sends or makes recipients retryable. */
export async function finalizeNewsletterAcceptedDelivery(editionId: string, expectedVersion: number, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const scope = await getContentOwnershipScope(actor.workspaceId);
    const legacyAllowed = "OR" in scope;
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT edition.id FROM "NewsletterEdition" edition JOIN "NewsletterSeries" series ON series.id = edition."seriesId"
      WHERE edition.id = ${editionId} AND edition."rowVersion" = ${expectedVersion}
        AND (series."workspaceId" = ${actor.workspaceId} OR (series."workspaceId" IS NULL AND ${legacyAllowed}))
      FOR UPDATE OF edition
    `;
    if (!locked.length) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
    const edition = await readDeliveryEvidence(tx, editionId, actor.workspaceId);
    if (!edition?.delivery || edition.rowVersion !== expectedVersion || edition.status !== "SENDING"
      || edition.approvedRevisionId !== edition.delivery.revisionId) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
    const delivery = edition.delivery;
    await tx.$queryRaw`SELECT id FROM "EmailCampaign" WHERE id = ${delivery.campaignId} AND "workspaceId" = ${actor.workspaceId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "CampaignRecipient" WHERE "campaignId" = ${delivery.campaignId} ORDER BY id FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "NewsletterJob" WHERE "editionId" = ${editionId} ORDER BY id FOR UPDATE`;
    const now = new Date();
    const busy = await tx.newsletterJob.findFirst({ where: {
      editionId, status: "CLAIMED", OR: [{ type: { not: "SEND" } }, { leaseExpiresAt: null }, { leaseExpiresAt: { gt: now } }],
    }, select: { id: true } });
    if (busy) throw new Error("NEWSLETTER_DELIVERY_BUSY");
    const completion = newsletterAcceptedCompletion({ revisionId: delivery.revisionId, recipients: delivery.campaign.recipients, attempts: delivery.attempts });
    const finished = await tx.newsletterEdition.updateMany({
      where: { id: edition.id, rowVersion: expectedVersion, status: "SENDING", approvedRevisionId: delivery.revisionId, series: scope },
      data: { status: "SENT", sentAt: completion.sentAt, rowVersion: { increment: 1 } },
    });
    if (finished.count !== 1) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
    const campaign = await tx.emailCampaign.updateMany({
      where: { id: delivery.campaignId, workspaceId: actor.workspaceId, rowVersion: delivery.campaign.rowVersion },
      data: { status: "SENT", recipientCount: completion.recipientCount, sentCount: completion.recipientCount, failedCount: 0, sentAt: completion.sentAt, rowVersion: { increment: 1 } },
    });
    if (campaign.count !== 1) throw new Error("NEWSLETTER_DELIVERY_REVIEW_CHANGED");
    await tx.newsletterDelivery.update({ where: { editionId: edition.id, campaignId: delivery.campaignId, revisionId: delivery.revisionId }, data: { completedAt: now } });
    await tx.newsletterJob.updateMany({
      where: { editionId, type: "SEND", status: "CLAIMED", leaseExpiresAt: { lte: now } },
      data: { status: "COMPLETED", completedAt: now, claimToken: null, leaseExpiresAt: null, lastErrorCode: "DELIVERY_RECONCILED_ACCEPTED", lastErrorMessage: null },
    });
    await tx.newsletterJob.updateMany({
      where: { editionId, type: "SEND", status: "PENDING" },
      data: { status: "CANCELLED", completedAt: now, lastErrorCode: "DELIVERY_RECONCILED_ACCEPTED" },
    });
    await tx.auditEvent.create({ data: {
      workspaceId: actor.workspaceId, actorId: actor.userId, action: "NEWSLETTER_ACCEPTED_DELIVERY_FINALIZED",
      entityType: "NewsletterEdition", entityId: edition.id,
      summary: "Closed an interrupted delivery using complete stored acceptance evidence. No email was sent.",
      metadata: { expectedVersion, campaignId: delivery.campaignId, recipientCount: completion.recipientCount,
        attemptIds: delivery.attempts.map(attempt => attempt.id), providerCalled: false },
    } });
    return { editionStatus: "SENT", sent: completion.recipientCount, automaticRetryAllowed: false as const };
  }, { isolationLevel: "RepeatableRead" });
}
