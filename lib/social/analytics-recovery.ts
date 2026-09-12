import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from '@/lib/workspace-write-access';

const REVIEW_AGE_MS = 30 * 60_000;
type ReviewRow = { id: string; connectionId: string; status: string; claimToken: string | null;
  claimedAt: Date | null; attempts: number; updatedAt: Date; platform: string; providerAccountId: string | null };

async function readLocked(tx: Prisma.TransactionClient, jobId: string, actor: WorkspaceWriteActor) {
  await requireLockedWorkspaceAdministrator(tx, actor);
  const rows = await tx.$queryRaw<ReviewRow[]>`
    SELECT j.id, j."connectionId", j.status::text, j."claimToken", j."claimedAt", j.attempts, j."updatedAt",
      c.platform::text, c."providerAccountId"
    FROM "SocialAnalyticsJob" j JOIN "SocialConnection" c ON c.id = j."connectionId"
    WHERE j.id = ${jobId} AND c."workspaceId" = ${actor.workspaceId}
    FOR UPDATE OF c, j
  `;
  if (rows.length !== 1) throw new Error('ANALYTICS_RECOVERY_NOT_FOUND');
  const job = rows[0];
  // The random claim token is never returned. Binding it into the opaque review
  // version prevents a replaced claim with the same timestamp being cancelled.
  const reviewVersion = createHash('sha256').update(JSON.stringify([
    actor.workspaceId, job.id, job.connectionId, job.status, job.claimToken,
    job.claimedAt?.toISOString(), job.attempts, job.updatedAt.toISOString(), job.platform, job.providerAccountId,
  ])).digest('hex');
  const now = new Date();
  const eligible = job.status === 'RUNNING' && Boolean(job.claimToken) && job.claimedAt !== null
    && job.claimedAt.getTime() <= now.getTime() - REVIEW_AGE_MS;
  return { job, reviewVersion, eligible, now };
}

export async function inspectAnalyticsRecovery(jobId: string, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  return prisma.$transaction(async tx => {
    const { job, reviewVersion, eligible, now } = await readLocked(tx, jobId, actor);
    return { jobId: job.id, connectionId: job.connectionId, platform: job.platform, status: job.status,
      claimedAt: job.claimedAt?.toISOString() ?? null, attempts: job.attempts, observedAt: now.toISOString(),
      reviewVersion, eligible, cancellationEnabled: process.env.STUDIO_V2_ANALYTICS_RECOVERY_ENABLED === 'true',
      automaticRetryAllowed: false as const };
  });
}

/** Fence a reviewed analytics read, not a publishing job. Never queue or call a provider. */
export async function cancelReviewedAnalytics(jobId: string, expectedReviewVersion: string, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  if (!/^[a-f0-9]{64}$/.test(expectedReviewVersion)) throw new Error('ANALYTICS_RECOVERY_CHANGED');
  return prisma.$transaction(async tx => {
    const { job, reviewVersion, eligible, now } = await readLocked(tx, jobId, actor);
    if (process.env.STUDIO_V2_ANALYTICS_RECOVERY_ENABLED !== 'true') throw new Error('ANALYTICS_RECOVERY_DISABLED');
    if (!eligible || reviewVersion !== expectedReviewVersion) throw new Error('ANALYTICS_RECOVERY_CHANGED');
    const changed = await tx.socialAnalyticsJob.updateMany({
      where: { id: job.id, connectionId: job.connectionId, connection: { workspaceId: actor.workspaceId },
        status: 'RUNNING', claimToken: job.claimToken, claimedAt: job.claimedAt, updatedAt: job.updatedAt, attempts: job.attempts },
      data: { status: 'CANCELLED', claimToken: null, completedAt: now },
    });
    if (changed.count !== 1) throw new Error('ANALYTICS_RECOVERY_CHANGED');
    await tx.auditEvent.create({ data: { workspaceId: actor.workspaceId, actorId: actor.userId,
      action: 'SOCIAL_ANALYTICS_REFRESH_CANCELLED', entityType: 'SocialAnalyticsJob', entityId: job.id,
      summary: 'An administrator stopped recording a reviewed stalled analytics refresh. No provider call or retry was started.',
      metadata: { connectionId: job.connectionId, attempts: job.attempts, claimedAt: job.claimedAt!.toISOString(), providerCalled: false },
    } });
    return { jobId: job.id, status: 'CANCELLED' as const, automaticRetryAllowed: false as const };
  });
}
