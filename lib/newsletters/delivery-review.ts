import "server-only";
import { prisma } from "@/lib/prisma";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { reviewNewsletterDelivery } from "./delivery-review-core";

export async function getNewsletterDeliveryReview(editionId: string, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const edition = await tx.newsletterEdition.findFirst({
      where: { id: editionId, series: await getContentOwnershipScope(actor.workspaceId) },
      select: { id: true, status: true, rowVersion: true, delivery: {
        select: { revisionId: true, campaign: { select: { workspaceId: true, recipients: {
          take: 5001, orderBy: { id: "asc" }, select: { id: true, status: true, providerMessageId: true },
        } } }, attempts: {
          where: { workspaceId: actor.workspaceId }, take: 5001, orderBy: { createdAt: "asc" },
          select: { revisionId: true, status: true, recipientIds: true, providerReceiptIds: true },
        } },
      } },
    });
    if (!edition) return null;
    const delivery = edition.delivery;
    if (!delivery) return { editionId: edition.id, editionStatus: edition.status, rowVersion: edition.rowVersion, delivery: null };
    const revision = await tx.newsletterRevision.findFirst({ where: { id: delivery.revisionId, editionId: edition.id }, select: { id: true } });
    const foreignAttempts = await tx.newsletterDeliveryAttempt.count({ where: { editionId: edition.id, workspaceId: { not: actor.workspaceId } } });
    if (!revision || foreignAttempts || delivery.campaign.workspaceId !== actor.workspaceId) throw new Error("NEWSLETTER_DELIVERY_OWNERSHIP_UNRESOLVED");
    if (delivery.campaign.recipients.length > 5000 || delivery.attempts.length > 5000) throw new Error("NEWSLETTER_DELIVERY_REVIEW_LIMIT");
    return { editionId: edition.id, editionStatus: edition.status, rowVersion: edition.rowVersion,
      delivery: reviewNewsletterDelivery({ revisionId: delivery.revisionId, recipients: delivery.campaign.recipients, attempts: delivery.attempts }),
    };
  }, { isolationLevel: "RepeatableRead" });
}
