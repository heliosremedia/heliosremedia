/** Validate stored relationships before resolving recipients or using a delivery campaign. */
export function assertNewsletterApprovalReferences(input: {
  editionId: string; currentRevisionNumber: number; intendedSendAt: Date; approvedRevisionId: string;
  revision: { id: string; editionId: string; revisionNumber: number };
  approval: { editionId: string; revisionId: string; approvedSendAt: Date; revokedAt: Date | null };
}) {
  const { revision, approval } = input;
  if (revision.id !== input.approvedRevisionId || revision.editionId !== input.editionId
    || revision.revisionNumber !== input.currentRevisionNumber || approval.editionId !== input.editionId
    || approval.revisionId !== revision.id || approval.revokedAt !== null
    || !Number.isFinite(approval.approvedSendAt.getTime())
    || approval.approvedSendAt.getTime() !== input.intendedSendAt.getTime()) {
    throw new Error("Newsletter approval no longer matches this edition and revision.");
  }
}

export function assertNewsletterDeliveryBinding(input: {
  editionId: string; revisionId: string; subject: string; previewText: string | null; verifiedHashes: string[];
  delivery: {
    editionId: string; revisionId: string; campaignId: string; contentHash: string;
    campaign: { id: string; subject: string; previewText: string | null; body: string };
  };
}) {
  const { delivery } = input;
  let body: unknown;
  try { body = JSON.parse(delivery.campaign.body); } catch { body = null; }
  const record = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (delivery.editionId !== input.editionId || delivery.revisionId !== input.revisionId
    || delivery.campaignId !== delivery.campaign.id || delivery.campaign.subject !== input.subject
    || (delivery.campaign.previewText ?? "") !== (input.previewText ?? "")
    || !input.verifiedHashes.some(hash => hash.toLowerCase() === delivery.contentHash.toLowerCase())
    || record?.newsletterEditionId !== input.editionId || record?.revisionId !== input.revisionId) {
    throw new Error("Newsletter delivery no longer matches its approved revision.");
  }
}
