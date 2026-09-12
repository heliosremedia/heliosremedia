import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readLockedRecovery(tx: Prisma.TransactionClient, editionId: string, actor: WorkspaceWriteActor) {
  await requireLockedWorkspaceAdministrator(tx, actor);
  const scope = await getContentOwnershipScope(actor.workspaceId);
  const legacyAllowed = "OR" in scope;
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT edition.id FROM "NewsletterEdition" edition JOIN "NewsletterSeries" series ON series.id = edition."seriesId"
    WHERE edition.id = ${editionId}
      AND (series."workspaceId" = ${actor.workspaceId} OR (series."workspaceId" IS NULL AND ${legacyAllowed}))
    FOR UPDATE OF series, edition
  `;
  if (!locked.length) throw new Error("NEWSLETTER_GENERATION_RECOVERY_CHANGED");
  await tx.$queryRaw`SELECT id FROM "NewsletterJob" WHERE "editionId" = ${editionId} ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "NewsletterGenerationRun" WHERE "editionId" = ${editionId} ORDER BY id FOR UPDATE`;
  const edition = await tx.newsletterEdition.findFirst({ where: { id: editionId, series: scope }, select: {
    id: true, seriesId: true, status: true, rowVersion: true,
    generationRuns: { orderBy: { attempt: "desc" }, take: 1, select: { id: true, status: true, instructionsSnapshot: true } },
  } });
  if (!edition) throw new Error("NEWSLETTER_GENERATION_RECOVERY_CHANGED");
  const run = edition.generationRuns[0];
  const snapshot = object(run?.instructionsSnapshot);
  const execution = object(snapshot.execution);
  const now = new Date();
  const job = typeof execution.jobId === "string" ? await tx.newsletterJob.findFirst({ where: {
    id: execution.jobId, editionId, type: "GENERATE", status: "CLAIMED", leaseExpiresAt: { lte: now },
  }, select: { id: true } }) : null;
  const running = await tx.newsletterGenerationRun.count({ where: { editionId, status: "RUNNING" } });
  const otherClaim = await tx.newsletterJob.findFirst({ where: { editionId, status: "CLAIMED", ...(job ? { id: { not: job.id } } : {}) }, select: { id: true } });
  const eligible = Boolean(edition.status === "GENERATING" && run?.status === "RUNNING" && running === 1
    && snapshot.workspaceId === actor.workspaceId && snapshot.seriesId === edition.seriesId
    && execution.kind === "BACKGROUND" && execution.editionVersion === edition.rowVersion && job && !otherClaim);
  return { edition, run, job, eligible, now, scope };
}

export async function getNewsletterGenerationRecovery(editionId: string, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  return prisma.$transaction(async tx => {
    const { edition, run, eligible } = await readLockedRecovery(tx, editionId, actor);
    return { editionId, rowVersion: edition.rowVersion, editionStatus: edition.status, runId: run?.id ?? null,
      eligible, automaticRetryAllowed: false as const };
  });
}

/** Return an expired background generation to review; never start generation or delivery. */
export async function recoverNewsletterGeneration(editionId: string, expectedVersion: number, runId: string, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || !runId) throw new Error("NEWSLETTER_GENERATION_RECOVERY_CHANGED");
  return prisma.$transaction(async tx => {
    const state = await readLockedRecovery(tx, editionId, actor);
    const { edition, run, job, now, scope } = state;
    if (!state.eligible || !job || run?.id !== runId || edition.rowVersion !== expectedVersion) throw new Error("NEWSLETTER_GENERATION_RECOVERY_CHANGED");
    const updated = await tx.newsletterEdition.updateMany({ where: { id: editionId, rowVersion: expectedVersion, status: "GENERATING", series: scope },
      data: { status: "NEEDS_REVIEW", approvedRevisionId: null, rowVersion: { increment: 1 } } });
    if (updated.count !== 1) throw new Error("NEWSLETTER_GENERATION_RECOVERY_CHANGED");
    const settled = await tx.newsletterGenerationRun.updateMany({ where: { id: runId, editionId, status: "RUNNING" }, data: {
      status: "FAILED", completedAt: now, errorCode: "ADMIN_RECOVERED_EXPIRED_GENERATION", errorMessage: "An administrator returned this interrupted generation to review.",
    } });
    if (settled.count !== 1) throw new Error("NEWSLETTER_GENERATION_RECOVERY_CHANGED");
    const fenced = await tx.newsletterJob.updateMany({ where: { id: job.id, editionId, type: "GENERATE", status: "CLAIMED", leaseExpiresAt: { lte: now } }, data: {
      status: "FAILED", completedAt: now, claimToken: null, leaseExpiresAt: null, lastErrorCode: "ADMIN_RECOVERED_EXPIRED_GENERATION", lastErrorMessage: null,
    } });
    if (fenced.count !== 1) throw new Error("NEWSLETTER_GENERATION_RECOVERY_CHANGED");
    await tx.newsletterJob.updateMany({ where: { editionId, type: "GENERATE", status: "PENDING" }, data: { status: "CANCELLED", completedAt: now, lastErrorCode: "ADMIN_RECOVERED_EXPIRED_GENERATION" } });
    await tx.newsletterApproval.updateMany({ where: { editionId, revokedAt: null }, data: { revokedAt: now, revocationReason: "Interrupted generation was returned to review." } });
    await tx.auditEvent.create({ data: {
      workspaceId: actor.workspaceId, actorId: actor.userId, action: "NEWSLETTER_GENERATION_RECOVERED", entityType: "NewsletterEdition", entityId: editionId,
      summary: "Returned an expired background generation to review. Existing content was preserved and no generation or delivery was started.",
      metadata: { expectedVersion, runId, jobId: job.id, providerCalled: false },
    } });
    return { editionStatus: "NEEDS_REVIEW", automaticRetryAllowed: false as const };
  });
}
