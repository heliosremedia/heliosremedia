import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifiedSourceFacts } from "./studio";

type CampaignSource = { sourceType: string; sourceRecordIds: unknown; sourceProjectId: string | null };

/** Rebuild context from an owned source, never from historical cached JSON. */
export async function resolveCampaignSourceContext(source: CampaignSource, workspaceId: string, tx: Prisma.TransactionClient = prisma) {
  if (!workspaceId) throw new Error("INVALID_SOCIAL_SOURCE");
  if (source.sourceRecordIds !== null && (!Array.isArray(source.sourceRecordIds) || source.sourceRecordIds.some((id) => typeof id !== "string" || !id.trim()))) throw new Error("INVALID_SOCIAL_SOURCE");
  const sourceIds = (source.sourceRecordIds || []) as string[];
  if (["PROJECT", "PORTFOLIO_ITEM", "BLOG", "NEWSLETTER"].includes(source.sourceType)) {
    if (sourceIds.length !== 1 || (source.sourceProjectId && (source.sourceProjectId !== sourceIds[0] || !["PROJECT", "PORTFOLIO_ITEM"].includes(source.sourceType)))) throw new Error("INVALID_SOCIAL_SOURCE");
    try {
      return { sourceIds, facts: await verifiedSourceFacts(source.sourceType, sourceIds[0], workspaceId, tx) };
    } catch { throw new Error("INVALID_SOCIAL_SOURCE"); }
  }
  if (!["MEDIA_LIBRARY", "UPLOADED_IMAGE", "UPLOADED_VIDEO", "AI_GENERATED_IMAGE", "BLANK"].includes(source.sourceType) || sourceIds.length || source.sourceProjectId) throw new Error("INVALID_SOCIAL_SOURCE");
  return { sourceIds, facts: {} as Prisma.InputJsonValue };
}
