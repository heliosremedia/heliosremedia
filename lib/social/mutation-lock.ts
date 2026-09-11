import type { Prisma } from "@/app/generated/prisma/client";

export async function lockEditableSocialVariant(tx: Prisma.TransactionClient, variantId: string, workspaceId: string) {
  await tx.$queryRaw`SELECT j.id FROM "SocialPublishingJob" j JOIN "SocialVariant" v ON v.id=j."variantId" JOIN "SocialCampaign" c ON c.id=v."campaignId" WHERE v.id=${variantId} AND c."workspaceId"=${workspaceId} ORDER BY j.id FOR UPDATE OF j`;
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT v.id FROM "SocialVariant" v JOIN "SocialCampaign" c ON c.id=v."campaignId" WHERE v.id=${variantId} AND c."workspaceId"=${workspaceId} FOR UPDATE OF v`;
  if (!locked.length) throw new Error("SOCIAL_VARIANT_NOT_FOUND");
  const executing = await tx.socialPublishingJob.findFirst({
    where: { variantId, variant: { campaign: { workspaceId } }, OR: [{ claimToken: { not: null } }, { status: { in: ["VALIDATING", "PUBLISHING", "PROVIDER_PROCESSING", "MANUAL_FALLBACK", "TRANSFERRED_AS_DRAFT", "REQUIRES_MANUAL_COMPLETION"] } }] }, select: { id: true },
  });
  if (executing) throw new Error("SOCIAL_PUBLICATION_IN_PROGRESS");
}
