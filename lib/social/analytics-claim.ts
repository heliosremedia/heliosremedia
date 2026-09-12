import 'server-only';
import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export type AnalyticsClaim = {
  jobId: string;
  claimToken: string;
  connectionId: string;
  workspaceId: string;
  platform: string;
  providerAccountId: string | null;
};

/** No provider operations belong in this transaction or in its error handler. */
export async function commitAnalyticsClaim(claim: AnalyticsClaim, write: (tx: Prisma.TransactionClient) => Promise<void>) {
  claim = { ...claim };
  if (!claim.workspaceId || !claim.claimToken) return 'CLAIM_CHANGED' as const;
  try {
    const committed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${claim.workspaceId} FOR UPDATE`;
      const connections = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "SocialConnection"
        WHERE id = ${claim.connectionId} AND "workspaceId" = ${claim.workspaceId}
          AND platform::text = ${claim.platform} AND "providerAccountId" IS NOT DISTINCT FROM ${claim.providerAccountId}
        FOR UPDATE
      `;
      if (connections.length !== 1) return false;
      const jobs = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "SocialAnalyticsJob" WHERE id = ${claim.jobId}
          AND "connectionId" = ${claim.connectionId} AND "claimToken" = ${claim.claimToken} AND status = 'RUNNING'
        FOR UPDATE
      `;
      if (jobs.length !== 1) return false;
      await write(tx);
      return true;
    });
    return committed ? 'CONFIRMED' as const : 'CLAIM_CHANGED' as const;
  } catch {
    // An acknowledgement can be lost after commit. Do not reinterpret it as a
    // provider failure, clear another claim, or attempt a second terminal write.
    return 'UNAVAILABLE' as const;
  }
}
