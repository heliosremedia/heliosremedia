import 'server-only';
import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export type PublishingClaim = {
  workspaceId: string;
  jobId: string;
  claimToken: string;
  connectionId: string;
  platform: string;
  providerAccountId: string | null;
  variantId: string;
  snapshotId: string;
  contentVersion: number;
  attemptNumber: number;
};

/** Internal persistence only. Never invoke a provider or retry on acknowledgement loss. */
export async function commitPublishingClaim(claim: PublishingClaim, write: (tx: Prisma.TransactionClient) => Promise<void>) {
  claim = { ...claim };
  if (!claim.workspaceId || !claim.claimToken) return 'CLAIM_CHANGED' as const;
  try {
    const committed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${claim.workspaceId} FOR UPDATE`;
      const connections = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "SocialConnection" WHERE id = ${claim.connectionId} AND "workspaceId" = ${claim.workspaceId}
          AND platform::text = ${claim.platform} AND "providerAccountId" IS NOT DISTINCT FROM ${claim.providerAccountId}
        FOR UPDATE
      `;
      if (connections.length !== 1) return false;
      const jobs = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT j.id FROM "SocialPublishingJob" j
        JOIN "SocialVariant" v ON v.id = j."variantId"
        JOIN "SocialCampaign" c ON c.id = v."campaignId"
        JOIN "SocialPublishingSnapshot" s ON s.id = j."snapshotId"
        WHERE j.id = ${claim.jobId} AND j."claimToken" = ${claim.claimToken} AND j.status = 'PUBLISHING'
          AND j."connectionId" = ${claim.connectionId} AND j."variantId" = ${claim.variantId}
          AND j."snapshotId" = ${claim.snapshotId} AND j.attempts = ${claim.attemptNumber}
          AND c."workspaceId" = ${claim.workspaceId} AND v."contentVersion" = ${claim.contentVersion}
          AND s."variantId" = v.id AND s."connectionId" = j."connectionId"
          AND s."contentVersion" = ${claim.contentVersion} AND s."invalidatedAt" IS NULL
        FOR UPDATE OF j, v, c, s
      `;
      if (jobs.length !== 1) return false;
      await write(tx);
      return true;
    });
    return committed ? 'CONFIRMED' as const : 'CLAIM_CHANGED' as const;
  } catch {
    // The transaction may already have committed. Keep existing evidence and
    // stop queue admission; a second terminal write cannot resolve uncertainty.
    return 'UNAVAILABLE' as const;
  }
}
