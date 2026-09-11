import { resolveCampaignSourceContext } from "@/lib/social/source-context";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import SocialCampaignEditor from "./SocialCampaignEditor";
import { getAdminSession } from "@/lib/auth/session";
import { publishingStorageReferenceMatches } from "@/lib/social/publishing-payload";

export const dynamic = "force-dynamic";

const localValue = (date: Date | null) => date ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(" ", "T") : "";

export default async function SocialCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const session = await getAdminSession();
  if (!session) notFound();
  const workspaceId = session.workspaceId;
  const [campaign, media, connections] = await Promise.all([
    prisma.socialCampaign.findFirst({ where: { id: campaignId, workspaceId }, include: { variants: { orderBy: { createdAt: "asc" }, include: {
      media: { where: { media: { visibility: "VISIBLE", project: { workspaceId } } }, orderBy: { displayOrder: "asc" }, include: { media: { include: { project: { select: { title: true, workspaceId: true } } } } } },
      generatedAssets: { where: { workspaceId }, select: { workspaceId: true, publicUrl: true, sourceMedia: { select: { projectId: true, storageKey: true, visibility: true, project: { select: { workspaceId: true } } } } } },
    } } } }),
    prisma.media.findMany({ where: { visibility: "VISIBLE", project: { workspaceId } }, orderBy: { updatedAt: "desc" }, take: 240, include: { project: { select: { title: true, workspaceId: true } } } }),
    prisma.socialConnection.findMany({where:{workspaceId,state:"CONNECTED",directPublishingEnabled:true},select:{id:true,platform:true,intendedAccountName:true,providerUsername:true,supportedPostTypes:true}}),
  ]);
  if (!campaign) notFound();
  const context = await resolveCampaignSourceContext(campaign, workspaceId).catch(() => ({ facts: {} }));
  const readableMedia = (item: { projectId: string; storageKey: string | null; visibility: string; project: { workspaceId: string } }) => item.project.workspaceId === workspaceId && item.visibility === "VISIBLE" && publishingStorageReferenceMatches(workspaceId, item.projectId, item.storageKey);
  const serializeMedia = (item: (typeof media)[number]) => ({ id: item.id, url: item.storageKey ? getPublicAssetUrl(item.storageKey) : item.externalUrl || "", altText: item.altText || item.originalFilename || "Company media", mimeType: item.mimeType, project: item.project.title, aspectRatio: item.aspectRatio });
  const library = media.filter(readableMedia).map(serializeMedia).filter((item) => item.url);
  return <SocialCampaignEditor initialCampaign={{
    id: campaign.id, internalName: campaign.internalName, purpose: campaign.purpose || "", targetAudience: campaign.targetAudience || "", primaryMessage: campaign.primaryMessage || "", sourceType: campaign.sourceType,
    verifiedSourceFacts: context.facts && typeof context.facts === "object" && !Array.isArray(context.facts) ? context.facts as Record<string, unknown> : {},
    generationStatus: campaign.generationStatus, generationError: campaign.generationError,
    variants: campaign.variants.map((variant) => ({
      id: variant.id, platform: variant.platform, postType: variant.postType, status: variant.status, caption: variant.caption || "", openingHook: variant.openingHook || "",
      hashtags: Array.isArray(variant.hashtags) ? variant.hashtags.filter((item): item is string => typeof item === "string") : [], callToAction: variant.callToAction || "", destinationLink: variant.destinationLink || "", altText: variant.altText || "",
      onScreenText: variant.onScreenText || "", videoConcept: variant.videoConcept || "", platformNotes: variant.platformNotes || "", internalNotes: variant.internalNotes || "", scheduledLocal: localValue(variant.scheduledAt),
      publicUrl: variant.publicUrl || "", publishedAt: variant.publishedAt?.toISOString() || null,
      suggestedCover: variant.generatedAssets.some((asset) => asset.workspaceId === workspaceId && asset.publicUrl === variant.suggestedCover && (!asset.sourceMedia || readableMedia(asset.sourceMedia))) ? variant.suggestedCover || "" : "",
      media: variant.media.filter((relation) => readableMedia(relation.media)).map((relation) => ({ id: relation.id, mediaId: relation.mediaId, altText: relation.altText || "", cropAspect: relation.cropAspect, media: serializeMedia(relation.media) })),
    })),
  }} library={library} connections={connections.map(item=>({id:item.id,platform:item.platform,label:item.providerUsername||item.intendedAccountName||`${item.platform} account`}))}/>;
}
