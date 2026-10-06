import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";

/** Internal aggregate reader. The caller must authorize campaign IDs in this transaction first. */
export async function readCampaignUnsubscribeCounts(tx: Prisma.TransactionClient, workspaceId: string, campaignIds: string[]) {
  const counts = new Map<string, Set<string>>(campaignIds.map(id => [id, new Set<string>()]));
  if (!workspaceId || !campaignIds.length) return new Map<string, number>();
  const select = { campaignId: true, preference: { select: { normalizedEmail: true } } } as const;
  const legacy = await tx.marketingEmailPreferenceEvent.findMany({
    where: { campaignId: { in: campaignIds }, status: "UNSUBSCRIBED" }, select,
  });
  const company = await tx.workspaceMarketingPreferenceEvent.findMany({
    where: { workspaceId, campaignId: { in: campaignIds }, status: "UNSUBSCRIBED" }, select,
  });
  // Addresses are used only for deduplication within this authorized aggregate;
  // neither addresses nor preference identities leave this reader.
  for (const event of [...legacy, ...company]) {
    if (event.campaignId) counts.get(event.campaignId)?.add(event.preference.normalizedEmail);
  }
  return new Map(Array.from(counts, ([id, addresses]) => [id, addresses.size]));
}
