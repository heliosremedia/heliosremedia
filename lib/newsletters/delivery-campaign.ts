import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

type Retry = { editionId: string; revisionId: string; workspaceId: string; campaignId: string; campaignWorkspaceId: string | null; campaignVersion: number };

/** Called only inside the transaction holding current delivery access and the edition claim. */
export async function prepareNewsletterCampaignRetry(tx: Prisma.TransactionClient, input: Retry) {
  if (input.campaignWorkspaceId !== input.workspaceId) {
    if (input.campaignWorkspaceId || tenantContextEnabled()) throw new Error("NEWSLETTER_DELIVERY_CLAIM_EXPIRED");
    await tx.$executeRaw`LOCK TABLE "Workspace" IN SHARE ROW EXCLUSIVE MODE`;
    const rows = await tx.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length !== 1 || rows[0].id !== input.workspaceId) throw new Error("NEWSLETTER_DELIVERY_CLAIM_EXPIRED");
  }
  await tx.$queryRaw`SELECT id FROM "EmailCampaign" WHERE id=${input.campaignId} FOR UPDATE`;
  const attempts = await tx.newsletterDeliveryAttempt.findMany({ where: { editionId: input.editionId }, select: { workspaceId: true, revisionId: true, status: true, recipientIds: true, providerReceiptIds: true } });
  for (const attempt of attempts) {
    if (attempt.workspaceId !== input.workspaceId || attempt.revisionId !== input.revisionId || ["PREPARED", "UNCERTAIN"].includes(attempt.status)) throw new Error("NEWSLETTER_DELIVERY_RECONCILIATION_REQUIRED");
    if (attempt.status === "REJECTED") {
      if (attempt.providerReceiptIds !== null && (!Array.isArray(attempt.providerReceiptIds) || attempt.providerReceiptIds.length)) throw new Error("NEWSLETTER_DELIVERY_RECONCILIATION_REQUIRED");
      continue;
    }
    const ids = attempt.recipientIds, receipts = attempt.providerReceiptIds;
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== "string") || new Set(ids).size !== ids.length || !Array.isArray(receipts) || receipts.length !== ids.length || new Set(receipts).size !== receipts.length || receipts.some(id => typeof id !== "string" || !id)) throw new Error("NEWSLETTER_DELIVERY_RECONCILIATION_REQUIRED");
    const recorded = await tx.campaignRecipient.findMany({ where: { campaignId: input.campaignId, id: { in: ids as string[] }, status: "SENT" }, select: { id: true, providerMessageId: true } });
    const byId = new Map(recorded.map(row => [row.id, row.providerMessageId]));
    if (ids.some((id, index) => byId.get(id as string) !== receipts[index])) throw new Error("NEWSLETTER_DELIVERY_RECONCILIATION_REQUIRED");
  }
  const changed = await tx.emailCampaign.updateMany({ where: { id: input.campaignId, workspaceId: input.campaignWorkspaceId, rowVersion: input.campaignVersion, status: { in: ["SENDING", "FAILED", "PARTIAL"] }, newsletterDelivery: { editionId: input.editionId, revisionId: input.revisionId } }, data: { status: "SENDING" } });
  if (changed.count !== 1) throw new Error("NEWSLETTER_DELIVERY_CLAIM_EXPIRED");
}
