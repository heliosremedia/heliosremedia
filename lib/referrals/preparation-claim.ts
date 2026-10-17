import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

export type ReferralPreparationClaim = {
  workspaceId: string; storedWorkspaceId: string | null; campaignId: string;
  revisionId: string; campaignVersion: number; attemptId: string; leaseExpiresAt: Date;
};

export function referralPreparationWhere(claim: ReferralPreparationClaim) {
  return { id: claim.campaignId, workspaceId: claim.storedWorkspaceId, status: "LAUNCHING" as const,
    rowVersion: claim.campaignVersion, approvedRevisionId: claim.revisionId, launchRevisionId: claim.revisionId,
    launchAttemptId: claim.attemptId, launchFailedAt: null, launchLeaseExpiresAt: claim.leaseExpiresAt,
    approvedRevision: { id: claim.revisionId, campaignId: claim.campaignId } };
}

/** Internal worker guard, held in the same transaction as every prepared batch. */
export async function lockReferralPreparationSource(tx: Prisma.TransactionClient, claim: ReferralPreparationClaim) {
  const reject = () => { throw new Error("REFERRAL_PREPARATION_CLAIM_EXPIRED"); };
  if (!claim.workspaceId || !Number.isFinite(claim.leaseExpiresAt.getTime())) reject();
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${claim.workspaceId} FOR UPDATE`;
  if (claim.storedWorkspaceId !== claim.workspaceId) {
    if (claim.storedWorkspaceId || tenantContextEnabled()) reject();
    await tx.$executeRaw`LOCK TABLE "Workspace" IN SHARE ROW EXCLUSIVE MODE`;
    const rows = await tx.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length !== 1 || rows[0].id !== claim.workspaceId) reject();
  }
  await tx.$queryRaw`SELECT id FROM "ReferralCampaign" WHERE id=${claim.campaignId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ReferralCampaignRevision" WHERE id=${claim.revisionId} FOR SHARE`;
  const current = await tx.referralCampaign.findFirst({
    where: { ...referralPreparationWhere(claim), launchLeaseExpiresAt: { equals: claim.leaseExpiresAt, gt: new Date() } },
    select: { approvedRevision: { select: { snapshot: true } } },
  });
  if (!current?.approvedRevision) return reject();
  const snapshot = current.approvedRevision.snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || ("workspaceId" in snapshot && snapshot.workspaceId !== claim.workspaceId)) reject();
}

/** Keep current sender/consent containment inside the actual batch transaction too. */
export async function lockReferralPreparationClaim(tx: Prisma.TransactionClient, claim: ReferralPreparationClaim) {
  if (tenantContextEnabled()) throw new Error("REFERRAL_PREPARATION_CONTAINED");
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${claim.workspaceId} FOR UPDATE`;
  await tx.$executeRaw`LOCK TABLE "Workspace" IN SHARE ROW EXCLUSIVE MODE`;
  const rows = await tx.workspace.findMany({ take: 2, select: { id: true } });
  if (rows.length !== 1 || rows[0].id !== claim.workspaceId) throw new Error("REFERRAL_PREPARATION_CONTAINED");
  await lockReferralPreparationSource(tx, claim);
}
