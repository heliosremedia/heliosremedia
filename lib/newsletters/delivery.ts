import { requireNewsletterDeliveryAccess, type NewsletterDeliveryContext } from "./delivery-access";
import { assertNewsletterApprovalReferences, assertNewsletterDeliveryBinding } from "./delivery-approval";
import { resolveCampaignWorkspace } from "@/lib/client-communications/campaign-ownership";
import { newsletterRecipientIdentity } from "./recipient-identity";
import { requireNewsletterApprovalWorkspace } from "@/lib/newsletters/ownership";
import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendCampaignBatch } from "@/lib/client-communications/email";
import { renderNewsletterEmail } from "@/lib/newsletters/email-renderer";
import { resolveEligibleNewsletterRecipients } from "@/lib/newsletters/recipients";
import type { RecipientSelection } from "@/lib/newsletters/types";
import { createPreferenceToken } from "@/lib/client-communications/preferences";
import { getSiteUrl } from "@/lib/site";
import { verifyNewsletterRevisionIntegrity } from "@/lib/newsletters/integrity";

function parseSelection(value: unknown): RecipientSelection {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<RecipientSelection> : {};
  const modes = new Set<RecipientSelection["mode"]>(["ALL", "GROUPS", "INDIVIDUALS", "GROUPS_AND_INDIVIDUALS"]);
  if (!candidate.mode || !modes.has(candidate.mode)) throw new Error("The approved recipient selection is invalid.");
  return {
    mode: candidate.mode,
    groupIds: Array.isArray(candidate.groupIds) ? candidate.groupIds.filter((id): id is string => typeof id === "string") : [],
    clientIds: Array.isArray(candidate.clientIds) ? candidate.clientIds.filter((id): id is string => typeof id === "string") : [],
  };
}

type SnapshotBlock = {
  type: string;
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLink?: string | null;
  imageIsVideo?: boolean | null;
  altText?: string | null;
  linkUrl?: string | null;
  link?: string | null;
  buttonLabel?: string | null;
};

function parseBlocks(value: unknown): SnapshotBlock[] {
  const snapshot = value && typeof value === "object" && !Array.isArray(value)
    ? value as { blocks?: unknown } : null;
  const blocks = Array.isArray(value) ? value : snapshot?.blocks;
  if (!Array.isArray(blocks) || !blocks.length) throw new Error("The approved newsletter revision has no content blocks.");
  return blocks.filter((block): block is SnapshotBlock => Boolean(block && typeof block === "object" && !Array.isArray(block)));
}

export async function deliverApprovedNewsletter(editionId: string, execution: NewsletterDeliveryContext) {
  if (!execution || !["ADMIN", "BACKGROUND"].includes(execution.kind)) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
  const context: NewsletterDeliveryContext = execution.kind === "ADMIN"
    ? { kind: "ADMIN", actor: { ...execution.actor } } : { ...execution };
  const edition = await prisma.newsletterEdition.findUnique({
    where: { id: editionId },
    include: {
      series: { include: { groups: true, recipients: true } },
      approvedRevision: true,
      approvals: { where: { revokedAt: null }, orderBy: { approvedAt: "desc" }, take: 1 },
      delivery: { include: { campaign: { include: { recipients: true } } } },
    },
  });
  if (!edition || !edition.approvedRevision || !edition.approvals[0]) throw new Error("Newsletter approval is missing.");
  if (edition.series.status !== "ACTIVE") throw new Error("This newsletter series is paused.");
  if (!["SCHEDULED", "SEND_FAILED", "PARTIALLY_SENT"].includes(edition.status)) {
    throw new Error("Only a scheduled or safely retryable newsletter can be sent.");
  }
  const approval = edition.approvals[0];
  assertNewsletterApprovalReferences({
    editionId: edition.id, currentRevisionNumber: edition.currentRevisionNumber,
    intendedSendAt: edition.intendedSendAt, approvedRevisionId: edition.approvedRevisionId!,
    revision: edition.approvedRevision, approval,
  });
  const selection = parseSelection(approval.recipientSelectionSnapshot);
  const workspaceId = await requireNewsletterApprovalWorkspace(approval.recipientSelectionSnapshot, edition.series.workspaceId);
  if (edition.delivery && await resolveCampaignWorkspace(edition.delivery.campaign.workspaceId) !== workspaceId) throw new Error("Newsletter delivery campaign belongs to another workspace.");
  const approvedBlocks = parseBlocks(edition.approvedRevision.blocksSnapshot);
  const integrity = verifyNewsletterRevisionIntegrity({
    subject: edition.approvedRevision.subject,
    previewText: edition.approvedRevision.previewText,
    blocks: approvedBlocks,
  }, edition.approvedRevision.contentHash);
  if (!integrity.valid) {
    throw new Error("Approved newsletter content failed its integrity check.");
  }
  const contentHash = integrity.canonicalHash;
  if (edition.delivery) assertNewsletterDeliveryBinding({
    editionId: edition.id, revisionId: edition.approvedRevision.id,
    subject: edition.approvedRevision.subject, previewText: edition.approvedRevision.previewText,
    verifiedHashes: [contentHash, edition.approvedRevision.contentHash], delivery: edition.delivery,
  });
  if (edition.status !== "SCHEDULED" && !edition.delivery) throw new Error("Retryable delivery campaign is missing.");
  await prisma.$transaction(tx => requireNewsletterDeliveryAccess(tx, edition.id, workspaceId, edition.intendedSendAt, context));
  const resolvedRecipients = await resolveEligibleNewsletterRecipients(workspaceId, selection);
  const eligible = resolvedRecipients.eligible;
  if (!eligible.length && !edition.delivery) throw new Error("No eligible newsletter recipients remain.");
  if (integrity.format !== "CANONICAL") {
    console.info("[newsletter-delivery] legacy_integrity_verified", {
      editionId: edition.id,
      revisionId: edition.approvedRevision.id,
      format: integrity.format,
    });
  }
  const blocks = approvedBlocks.map((block) => ({
    ...block,
    imageAlt: block.imageAlt ?? block.altText,
    linkUrl: block.linkUrl ?? block.link,
  }));

  const campaign = await prisma.$transaction(async (transaction) => {
      await requireNewsletterDeliveryAccess(transaction, edition.id, workspaceId, edition.intendedSendAt, context);
      const claimed = await transaction.newsletterEdition.updateMany({
        where: {
          id: edition.id, rowVersion: edition.rowVersion, intendedSendAt: edition.intendedSendAt,
          status: edition.status,
          approvedRevisionId: edition.approvedRevision!.id,
          series: { status: "ACTIVE", workspaceId: edition.series.workspaceId },
          approvals: { some: { id: approval.id, revokedAt: null, revisionId: edition.approvedRevision!.id, approvedSendAt: edition.intendedSendAt } },
        },
        data: { status: "SENDING", rowVersion: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new Error("Newsletter delivery was already claimed.");
      if (context.kind === "ADMIN") await transaction.newsletterJob.updateMany({
        where: { editionId: edition.id, type: "SEND", status: "PENDING" },
        data: { status: "CANCELLED", completedAt: new Date(), lastErrorCode: "MANUAL_SEND_CLAIMED" },
      });
      if (edition.delivery) return edition.delivery.campaign;
      const nextCampaign = await transaction.emailCampaign.create({
        data: {
          workspaceId,
          subject: edition.approvedRevision!.subject,
          previewText: edition.approvedRevision!.previewText,
          body: JSON.stringify({ newsletterEditionId: edition.id, revisionId: edition.approvedRevision!.id, blocks }),
          status: "SENDING",
          recipientMode: selection.mode,
          selection,
          recipientCount: eligible.length,
          createdById: edition.createdById,
          recipients: {
            create: eligible.map((recipient) => ({
              clientId: recipient.id, email: recipient.email, displayName: recipient.displayName,
            })),
          },
        },
        include: { recipients: true },
      });
      await transaction.newsletterDelivery.create({
        data: {
          editionId: edition.id,
          campaignId: nextCampaign.id,
          revisionId: edition.approvedRevision!.id,
          recipientSnapshot: eligible.map((recipient) => ({
            clientId: recipient.id, email: recipient.email, displayName: recipient.displayName,
          })),
          eligibleCount: eligible.length,
          excludedCount: Math.max(0, approval.estimatedEligibleCount + approval.estimatedExcludedCount - eligible.length),
          contentHash,
          startedAt: new Date(),
        },
      });
      return nextCampaign;
  });

  const currentlyEligible = new Set(eligible.map((recipient) => newsletterRecipientIdentity(recipient.id, recipient.normalizedEmail)));
  const newlyIneligible = campaign.recipients.filter((recipient) =>
    (recipient.status === "PENDING" || recipient.status === "FAILED") &&
    !currentlyEligible.has(newsletterRecipientIdentity(recipient.clientId, recipient.email)));
  if (newlyIneligible.length) {
    await prisma.campaignRecipient.updateMany({
      where: { id: { in: newlyIneligible.map((recipient) => recipient.id) } },
      data: { status: "SKIPPED", error: "Recipient became ineligible before newsletter delivery." },
    });
  }
  const pending = campaign.recipients.filter((recipient) =>
    (recipient.status === "PENDING" || recipient.status === "FAILED") &&
    currentlyEligible.has(newsletterRecipientIdentity(recipient.clientId, recipient.email)));
  let sent = campaign.recipients.filter((recipient) => recipient.status === "SENT").length;
  let failed = 0;
  for (let index = 0; index < pending.length; index += 100) {
    // Do not resume an expired worker or revoked administrator between batches.
    await prisma.$transaction(async tx => {
      await requireNewsletterDeliveryAccess(tx, edition.id, workspaceId, edition.intendedSendAt, context);
      const active = await tx.newsletterEdition.findFirst({
        where: { id: edition.id, rowVersion: edition.rowVersion + 1, status: "SENDING", approvedRevisionId: edition.approvedRevision!.id, series: { workspaceId: edition.series.workspaceId, status: "ACTIVE" } },
        select: { id: true },
      });
      if (!active) throw new Error("NEWSLETTER_DELIVERY_CLAIM_EXPIRED");
    });
    const batch = pending.slice(index, index + 100);
    try {
      const tokens = await Promise.all(batch.map(recipient =>
        createPreferenceToken({ clientId: recipient.clientId, campaignId: campaign!.id })));
      const batchKey = createHash("sha256")
        .update(batch.map((recipient) => recipient.id).sort().join(":"))
        .digest("hex")
        .slice(0, 24);
      const result = await sendCampaignBatch({
        campaignId: `${campaign.id}:newsletter:${batchKey}`,
        source: "newsletter",
        revisionKey: edition.approvedRevision.id,
        messages: batch.map((recipient, offset) => ({
          to: recipient.email,
          subject: campaign!.subject,
          html: renderNewsletterEmail({
            previewText: campaign!.previewText,
            blocks,
            unsubscribeToken: tokens[offset],
            businessName: edition.series.senderName || "Helios Real Estate Media",
          }),
          unsubscribeUrl: `${getSiteUrl()}/api/unsubscribe?token=${encodeURIComponent(tokens[offset])}`,
        })),
      });
      await prisma.$transaction(batch.map((recipient, offset) => prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "SENT", sentAt: new Date(), providerMessageId: result[offset]?.id ?? null, error: null },
      })));
      sent += batch.length;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown delivery error";
      await prisma.campaignRecipient.updateMany({
        where: { id: { in: batch.map((recipient) => recipient.id) }, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "FAILED", error: message },
      });
      failed += batch.length;
    }
  }

  const campaignStatus = sent && failed ? "PARTIAL" : sent ? "SENT" : "FAILED";
  const editionStatus = sent && failed ? "PARTIALLY_SENT" : sent ? "SENT" : "SEND_FAILED";
  const completedAt = new Date();
  await prisma.$transaction(async tx => {
    // Record the captured execution's outcome even if its actor was revoked after provider acceptance.
    const finished = await tx.newsletterEdition.updateMany({
      where: { id: edition.id, rowVersion: edition.rowVersion + 1, status: "SENDING", approvedRevisionId: edition.approvedRevision!.id, series: { workspaceId: edition.series.workspaceId } },
      data: { status: editionStatus, sentAt: sent ? completedAt : null, rowVersion: { increment: 1 } },
    });
    if (finished.count !== 1) throw new Error("NEWSLETTER_DELIVERY_CLAIM_EXPIRED");
    await tx.emailCampaign.update({
      where: { id: campaign.id, workspaceId: campaign.workspaceId },
      data: { status: campaignStatus, sentCount: sent, failedCount: failed, sentAt: sent ? completedAt : null },
    });
    await tx.newsletterDelivery.update({
      where: { editionId: edition.id, campaignId: campaign.id, revisionId: edition.approvedRevision!.id },
      data: { completedAt },
    });
  });
  return { campaignId: campaign.id, sent, failed, status: editionStatus };
}
