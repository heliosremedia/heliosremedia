import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendCampaignBatch } from "@/lib/client-communications/email";
import { renderNewsletterEmail } from "@/lib/newsletters/email-renderer";
import { resolveEligibleNewsletterRecipients } from "@/lib/newsletters/recipients";
import type { RecipientSelection } from "@/lib/newsletters/types";

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

export async function deliverApprovedNewsletter(editionId: string) {
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
  if (!["SCHEDULED", "SENDING"].includes(edition.status)) throw new Error("Only a scheduled newsletter can be sent.");
  if (edition.approvedRevision.id !== edition.approvedRevisionId) throw new Error("The approved newsletter revision no longer matches.");

  const approval = edition.approvals[0];
  const selection = parseSelection(approval.recipientSelectionSnapshot);
  // Eligibility is deliberately resolved again immediately before campaign creation.
  const resolvedRecipients = await resolveEligibleNewsletterRecipients(selection);
  const eligible = resolvedRecipients.eligible;
  if (!eligible.length && !edition.delivery) throw new Error("No eligible newsletter recipients remain.");
  const approvedBlocks = parseBlocks(edition.approvedRevision.blocksSnapshot);
  const contentHash = createHash("sha256").update(JSON.stringify({
    subject: edition.approvedRevision.subject,
    previewText: edition.approvedRevision.previewText,
    blocks: approvedBlocks,
  })).digest("hex");
  if (contentHash !== edition.approvedRevision.contentHash) throw new Error("Approved newsletter content failed its integrity check.");
  const blocks = approvedBlocks.map((block) => ({
    ...block,
    imageAlt: block.imageAlt ?? block.altText,
    linkUrl: block.linkUrl ?? block.link,
  }));

  let campaign = edition.delivery?.campaign;
  if (!campaign) {
    const created = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.newsletterEdition.updateMany({
        where: {
          id: edition.id,
          status: "SCHEDULED",
          approvedRevisionId: edition.approvedRevision!.id,
          series: { status: "ACTIVE" },
        },
        data: { status: "SENDING" },
      });
      if (claimed.count !== 1) throw new Error("Newsletter delivery was already claimed.");
      const nextCampaign = await transaction.emailCampaign.create({
        data: {
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
    campaign = created;
  }

  const currentlyEligible = new Set(eligible.map((recipient) => recipient.normalizedEmail));
  const newlyIneligible = campaign.recipients.filter((recipient) =>
    (recipient.status === "PENDING" || recipient.status === "FAILED") &&
    !currentlyEligible.has(recipient.email.trim().toLowerCase()));
  if (newlyIneligible.length) {
    await prisma.campaignRecipient.updateMany({
      where: { id: { in: newlyIneligible.map((recipient) => recipient.id) } },
      data: { status: "SKIPPED", error: "Recipient became ineligible before newsletter delivery." },
    });
  }
  const pending = campaign.recipients.filter((recipient) =>
    (recipient.status === "PENDING" || recipient.status === "FAILED") &&
    currentlyEligible.has(recipient.email.trim().toLowerCase()));
  let sent = campaign.recipients.filter((recipient) => recipient.status === "SENT").length;
  let failed = 0;
  for (let index = 0; index < pending.length; index += 100) {
    const batch = pending.slice(index, index + 100);
    try {
      const batchKey = createHash("sha256")
        .update(batch.map((recipient) => recipient.id).sort().join(":"))
        .digest("hex")
        .slice(0, 24);
      const result = await sendCampaignBatch({
        campaignId: `${campaign.id}:newsletter:${batchKey}`,
        messages: batch.map((recipient) => ({
          to: recipient.email,
          subject: campaign!.subject,
          html: renderNewsletterEmail({
            previewText: campaign!.previewText,
            blocks,
            clientId: recipient.clientId,
            businessName: edition.series.senderName || "Helios Real Estate Media",
          }),
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
  await prisma.$transaction([
    prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: campaignStatus, sentCount: sent, failedCount: failed, sentAt: sent ? completedAt : null },
    }),
    prisma.newsletterEdition.update({
      where: { id: edition.id },
      data: { status: editionStatus, sentAt: sent ? completedAt : null },
    }),
    prisma.newsletterDelivery.update({
      where: { editionId: edition.id },
      data: { completedAt },
    }),
  ]);
  return { campaignId: campaign.id, sent, failed, status: editionStatus };
}
