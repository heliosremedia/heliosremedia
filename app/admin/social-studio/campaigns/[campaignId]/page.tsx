import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import SocialCampaignEditor from "./SocialCampaignEditor";
import { getAdminSession } from "@/lib/auth/session";
import { requireWorkspaceId } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

const localValue = (date: Date | null) => date ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(" ", "T") : "";

export default async function SocialCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const session = await getAdminSession();
  if (!session) notFound();
  const workspaceId = await requireWorkspaceId(session.userId);
  const [campaign, media, connections] = await Promise.all([
    prisma.socialCampaign.findFirst({ where: { id: campaignId, workspaceId }, include: { variants: { orderBy: { createdAt: "asc" }, include: { media: { orderBy: { displayOrder: "asc" }, include: { media: { include: { project: { select: { title: true } } } } } } } } } }),
    prisma.media.findMany({ where: { visibility: "VISIBLE", project: { workspaceId } }, orderBy: { updatedAt: "desc" }, take: 240, include: { project: { select: { title: true } } } }),
    prisma.socialConnection.findMany({where:{workspaceId,state:"CONNECTED",directPublishingEnabled:true},select:{id:true,platform:true,intendedAccountName:true,providerUsername:true,supportedPostTypes:true}}),
  ]);
  if (!campaign) notFound();
  const serializeMedia = (item: (typeof media)[number]) => ({ id: item.id, url: item.storageKey ? getPublicAssetUrl(item.storageKey) : item.externalUrl || "", altText: item.altText || item.originalFilename || "Helios media", mimeType: item.mimeType, project: item.project.title, aspectRatio: item.aspectRatio });
  const library = media.map(serializeMedia).filter((item) => item.url);
  return <SocialCampaignEditor initialCampaign={{
    id: campaign.id, internalName: campaign.internalName, purpose: campaign.purpose || "", targetAudience: campaign.targetAudience || "", primaryMessage: campaign.primaryMessage || "", sourceType: campaign.sourceType,
    verifiedSourceFacts: campaign.verifiedSourceFacts && typeof campaign.verifiedSourceFacts === "object" && !Array.isArray(campaign.verifiedSourceFacts) ? campaign.verifiedSourceFacts as Record<string, unknown> : {},
    generationStatus: campaign.generationStatus, generationError: campaign.generationError,
    variants: campaign.variants.map((variant) => ({
      id: variant.id, platform: variant.platform, postType: variant.postType, status: variant.status, caption: variant.caption || "", openingHook: variant.openingHook || "",
      hashtags: Array.isArray(variant.hashtags) ? variant.hashtags.filter((item): item is string => typeof item === "string") : [], callToAction: variant.callToAction || "", destinationLink: variant.destinationLink || "", altText: variant.altText || "",
      onScreenText: variant.onScreenText || "", videoConcept: variant.videoConcept || "", platformNotes: variant.platformNotes || "", internalNotes: variant.internalNotes || "", scheduledLocal: localValue(variant.scheduledAt),
      publicUrl: variant.publicUrl || "", publishedAt: variant.publishedAt?.toISOString() || null,
      suggestedCover: variant.suggestedCover || "",
      media: variant.media.map((relation) => ({ id: relation.id, mediaId: relation.mediaId, altText: relation.altText || "", cropAspect: relation.cropAspect, media: serializeMedia(relation.media) })),
    })),
  }} library={library} connections={connections.map(item=>({id:item.id,platform:item.platform,label:item.providerUsername||item.intendedAccountName||`${item.platform} account`}))}/>;
}
