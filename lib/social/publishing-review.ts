import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireLockedWorkspaceAdministrator, requireLockedWorkspaceEditor, type WorkspaceWriteActor } from '@/lib/workspace-write-access';

type QueueRow = { id: string; campaign: string; campaignId: string; variantId: string; platform: string;
  account: string | null; postType: string; status: string; scheduledAt: Date; attempts: number; maxAttempts: number;
  errorCategory: string | null; publicUrl: string | null; hasClaim: boolean };

function safePublicUrl(value: string | null) {
  if (!value) return '';
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}

/** Operational queue now requires fresh editor access and consistent content/destination parents. */
export async function getPublishingQueue(inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceEditor(tx, actor);
    const rows = await tx.$queryRaw<QueueRow[]>`
      SELECT j.id, c."internalName" AS campaign, c.id AS "campaignId", v.id AS "variantId", x.platform::text,
        COALESCE(NULLIF(x."providerUsername", ''), x."intendedAccountName") AS account, v."postType"::text,
        j.status::text, j."scheduledAt", j.attempts, j."maxAttempts", j."lastErrorCategory"::text AS "errorCategory",
        j."publicUrl", j."claimToken" IS NOT NULL AS "hasClaim"
      FROM "SocialPublishingJob" j
      JOIN "SocialVariant" v ON v.id = j."variantId"
      JOIN "SocialCampaign" c ON c.id = v."campaignId"
      JOIN "SocialConnection" x ON x.id = j."connectionId" AND x.platform = v.platform
      JOIN "SocialPublishingSnapshot" s ON s.id = j."snapshotId" AND s."variantId" = v.id AND s."connectionId" = x.id
      WHERE c."workspaceId" = ${actor.workspaceId} AND x."workspaceId" = ${actor.workspaceId}
      ORDER BY j."scheduledAt" ASC, j."createdAt" DESC, j.id ASC LIMIT 200
    `;
    return rows.map(({ errorCategory, publicUrl, ...row }) => ({ ...row, account: row.account || 'Unconfigured account',
      scheduledAt: row.scheduledAt.toISOString(), publicUrl: safePublicUrl(publicUrl),
      error: errorCategory ? `Recorded category: ${errorCategory.replaceAll('_', ' ')}. Inspect publication evidence before taking action.` : '' }));
  });
}

type ReviewRow = { jobId: string; status: string; platform: string; attempts: number; claimedAt: Date | null;
  hasClaim: boolean; hasSubmission: boolean; hasExternalPost: boolean; completedAt: Date | null;
  currentVersion: number; approvedVersion: number; invalidatedAt: Date | null; errorCategory: string | null };
type AttemptRow = { attemptNumber: number; status: string; createdAt: Date; errorCategory: string | null;
  hasSubmission: boolean; hasExternalPost: boolean };

/** Recorded local evidence only. No provider call, retry, cancellation or publication mutation. */
export async function inspectPublishingReview(jobId: string, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const rows = await tx.$queryRaw<ReviewRow[]>`
      SELECT j.id AS "jobId", j.status::text, x.platform::text, j.attempts, j."claimedAt", j."completedAt",
        j."claimToken" IS NOT NULL AS "hasClaim", j."providerSubmissionId" IS NOT NULL AS "hasSubmission",
        j."externalPostId" IS NOT NULL AS "hasExternalPost", j."lastErrorCategory"::text AS "errorCategory",
        v."contentVersion" AS "currentVersion", s."contentVersion" AS "approvedVersion", s."invalidatedAt"
      FROM "SocialPublishingJob" j
      JOIN "SocialVariant" v ON v.id = j."variantId"
      JOIN "SocialCampaign" c ON c.id = v."campaignId"
      JOIN "SocialConnection" x ON x.id = j."connectionId" AND x.platform = v.platform
      JOIN "SocialPublishingSnapshot" s ON s.id = j."snapshotId" AND s."variantId" = v.id AND s."connectionId" = x.id
      WHERE j.id = ${jobId} AND c."workspaceId" = ${actor.workspaceId} AND x."workspaceId" = ${actor.workspaceId}
      FOR UPDATE OF j
    `;
    if (rows.length !== 1) throw new Error('PUBLISHING_REVIEW_NOT_FOUND');
    const row = rows[0];
    const attempts = await tx.$queryRaw<AttemptRow[]>`
      SELECT "attemptNumber", status::text, "createdAt", "errorCategory"::text,
        "providerSubmissionId" IS NOT NULL AS "hasSubmission", "externalPostId" IS NOT NULL AS "hasExternalPost"
      FROM "SocialPublishingAttempt" WHERE "jobId" = ${row.jobId}
      ORDER BY "attemptNumber" DESC, id DESC LIMIT 11
    `;
    return { ...row, claimedAt: row.claimedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null,
      invalidatedAt: row.invalidatedAt?.toISOString() ?? null, observedAt: new Date().toISOString(),
      attemptsTruncated: attempts.length > 10, attemptsLog: attempts.slice(0, 10).map(attempt => ({ ...attempt, createdAt: attempt.createdAt.toISOString() })),
      approvalRevisionChanged: row.currentVersion !== row.approvedVersion || row.invalidatedAt !== null,
      assessment: row.status === 'PUBLISHED' ? 'LOCAL_PUBLICATION_RECORDED' as const
        : row.status === 'PROVIDER_PROCESSING' ? 'PROVIDER_PROCESSING_RECORDED' as const
        : row.status === 'VALIDATING' ? 'VALIDATION_UNRESOLVED' as const
        : row.status === 'PUBLISHING' || row.status === 'MANUAL_FALLBACK' || row.errorCategory === 'AMBIGUOUS'
          ? 'OUTCOME_UNCONFIRMED' as const : 'RECORDED_STATE_REVIEW' as const,
      providerChecked: false as const, recoveryAllowed: false as const, automaticRetryAllowed: false as const };
  });
}
