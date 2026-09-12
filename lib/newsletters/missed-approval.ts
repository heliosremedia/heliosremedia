import "server-only";
import { prisma } from "@/lib/prisma";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { resolveNewsletterWorkspace } from "./ownership";

/** Apply an elapsed approval deadline only under its current owned job claim. */
export async function markNewsletterApprovalMissed(input: { id: string; editionId: string; claimToken: string }) {
  const job = { id: input.id, editionId: input.editionId, claimToken: input.claimToken };
  if (!job.id || !job.editionId || !job.claimToken) throw new Error("NEWSLETTER_APPROVAL_CLAIM_EXPIRED");
  const owner = await prisma.newsletterEdition.findUnique({ where: { id: job.editionId }, select: { series: { select: { workspaceId: true } } } });
  if (!owner) throw new Error("Newsletter edition was not found.");
  const workspaceId = await resolveNewsletterWorkspace(owner.series.workspaceId);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
    const scope = await getContentOwnershipScope(workspaceId);
    const legacyAllowed = "OR" in scope;
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT edition.id FROM "NewsletterEdition" edition JOIN "NewsletterSeries" series ON series.id = edition."seriesId"
      WHERE edition.id = ${job.editionId}
        AND (series."workspaceId" = ${workspaceId} OR (series."workspaceId" IS NULL AND ${legacyAllowed}))
      FOR UPDATE OF series, edition
    `;
    if (!rows.length) throw new Error("NEWSLETTER_APPROVAL_CLAIM_EXPIRED");
    await tx.$queryRaw`SELECT id FROM "NewsletterJob" WHERE id = ${job.id} AND "editionId" = ${job.editionId} FOR UPDATE`;
    const now = new Date();
    const edition = await tx.newsletterEdition.findFirst({ where: { id: job.editionId, series: scope }, select: { status: true, rowVersion: true, intendedSendAt: true, series: { select: { status: true } } } });
    if (!edition) throw new Error("NEWSLETTER_APPROVAL_CLAIM_EXPIRED");
    const claim = await tx.newsletterJob.findFirst({ where: {
      id: job.id, editionId: job.editionId, claimToken: job.claimToken, type: "MISSED_APPROVAL", status: "CLAIMED",
      leaseExpiresAt: { gt: now }, dueAt: edition.intendedSendAt, AND: [{ dueAt: { lte: now } }],
    }, select: { id: true } });
    if (!claim) throw new Error("NEWSLETTER_APPROVAL_CLAIM_EXPIRED");
    const states = ["AWAITING_GENERATION", "GENERATING", "DRAFT_GENERATED", "NEEDS_REVIEW", "APPROVED", "GENERATION_FAILED"] as const;
    if (edition.series.status !== "ACTIVE" || !states.some(status => status === edition.status)) return { changed: false };
    const changed = await tx.newsletterEdition.updateMany({ where: {
      id: job.editionId, rowVersion: edition.rowVersion, status: edition.status, intendedSendAt: edition.intendedSendAt, series: scope,
    }, data: { status: "MISSED_APPROVAL", approvedRevisionId: null, rowVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("NEWSLETTER_EDITION_CHANGED");
    await tx.newsletterApproval.updateMany({ where: { editionId: job.editionId, revokedAt: null }, data: {
      revokedAt: now, revocationReason: "The intended send time passed without scheduling approval.",
    } });
    await tx.auditEvent.create({ data: {
      workspaceId, action: "NEWSLETTER_APPROVAL_DEADLINE_MISSED", entityType: "NewsletterEdition", entityId: job.editionId,
      summary: "The approval deadline elapsed. The edition was held for a deliberate new schedule.",
      metadata: { jobId: job.id, expectedVersion: edition.rowVersion, intendedSendAt: edition.intendedSendAt.toISOString(), providerCalled: false },
    } });
    return { changed: true };
  });
}
