import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { getBlogOwnershipScope } from "@/lib/blog-ownership";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { contentEditState, SOCIAL_TIME_ZONE, type VariantState } from "./core";

export const SOCIAL_SETTINGS_DEFAULTS = {
  brandVoice: "Refined, confident, thoughtful, visually driven, premium but approachable. Clear and human without sounding overly promotional, generic, or automated.",
  primaryAudience: "Real estate agents, brokers, teams, builders, designers, and property-marketing professionals—primarily within Northern Colorado.",
  writingGuardrails: "Never invent statistics, market conditions, property details, client outcomes, testimonials, pricing, awards, or service claims. Avoid clickbait, keyword stuffing, generic AI language, and excessive hashtags.",
  defaultCallToAction: "Invite the audience to explore the relevant Helios work or service when appropriate.",
  hashtagGuidance: "Use a selective set of specific, relevant hashtags. Avoid stuffing and generic reach-bait tags.",
  prohibitedTopics: "Unsupported claims, fabricated results, politics, legal advice, and representation of AI imagery as authentic Helios property photography.",
};

export async function ensureSocialSettings(workspaceId: string) {
  return prisma.socialStudioSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, ...SOCIAL_SETTINGS_DEFAULTS },
    update: {},
  });
}

const text = (value: string | null | undefined, max = 12_000) => value?.trim().slice(0, max) || "";

export async function verifiedProjectFacts(projectId: string, workspaceId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true, title: true, slug: true, shortDescription: true, description: true,
      city: true, state: true, locationLabel: true, projectType: true, propertyType: true,
      publishedAt: true,
      details: { select: { listingAgent: true, brokerage: true, builder: true, architect: true, interiorDesigner: true, squareFeet: true, bedrooms: true, bathrooms: true, lotSize: true, neighborhood: true, propertyWebsiteUrl: true } },
    },
  });
  if (!project) throw new Error("The selected project no longer exists.");
  return {
    sourceId: project.id, title: project.title, slug: project.slug,
    shortDescription: text(project.shortDescription), description: text(project.description),
    city: text(project.city), state: text(project.state), locationLabel: text(project.locationLabel),
    projectType: text(project.projectType), propertyType: text(project.propertyType),
    publishedAt: project.publishedAt?.toISOString() || "",
    listingAgent: text(project.details?.listingAgent), brokerage: text(project.details?.brokerage),
    builder: text(project.details?.builder), architect: text(project.details?.architect),
    interiorDesigner: text(project.details?.interiorDesigner), squareFeet: project.details?.squareFeet || "",
    bedrooms: project.details?.bedrooms || "", bathrooms: project.details?.bathrooms || "",
    lotSize: text(project.details?.lotSize), neighborhood: text(project.details?.neighborhood),
    propertyWebsiteUrl: text(project.details?.propertyWebsiteUrl),
  } satisfies Prisma.InputJsonValue;
}

export async function verifiedSourceFacts(sourceType: string, sourceRecordId: string, workspaceId: string) {
  if (sourceType === "PROJECT" || sourceType === "PORTFOLIO_ITEM") return verifiedProjectFacts(sourceRecordId, workspaceId);
  if (sourceType === "BLOG") {
    const post = await prisma.blogPost.findFirst({
      where: { AND: [await getBlogOwnershipScope(workspaceId)], id: sourceRecordId, status: "PUBLISHED" },
      select: { id: true, title: true, slug: true, excerpt: true, content: true, author: true, category: true, publishedAt: true, canonicalUrl: true, socialCaption: true },
    });
    if (!post) throw new Error("The selected published blog no longer exists.");
    return {
      sourceId: post.id, title: post.title, slug: post.slug, excerpt: text(post.excerpt),
      content: text(post.content), author: text(post.author), category: text(post.category),
      publishedAt: post.publishedAt?.toISOString() || "", canonicalUrl: text(post.canonicalUrl),
      socialCaption: text(post.socialCaption),
    } satisfies Prisma.InputJsonValue;
  }
  if (sourceType === "NEWSLETTER") {
    const edition = await prisma.newsletterEdition.findFirst({
      where: { id: sourceRecordId, series: await getBlogOwnershipScope(workspaceId), status: "SENT" },
      select: { id: true, subject: true, previewText: true, intendedSendAt: true, sentAt: true, series: { select: { name: true, description: true } }, blocks: { orderBy: { position: "asc" }, select: { type: true, internalLabel: true, content: true } } },
    });
    if (!edition) throw new Error("The selected sent newsletter no longer exists.");
    return {
      sourceId: edition.id, subject: text(edition.subject), previewText: text(edition.previewText),
      seriesName: edition.series.name, seriesDescription: text(edition.series.description),
      intendedSendAt: edition.intendedSendAt.toISOString(), sentAt: edition.sentAt?.toISOString() || "",
      contentBlocks: text(JSON.stringify(edition.blocks)),
    } satisfies Prisma.InputJsonValue;
  }
  return {} satisfies Prisma.InputJsonValue;
}

type SocialContentChange =
  | { kind: "MEDIA_PRESENTATION"; relationId: string; data: { altText: string; cropAspect: string | null; cropX: number; cropY: number; cropScale: number } }
  | { kind: "MEDIA_SELECTION"; mediaIds: string[] }
  | { kind: "AI_IMAGE"; assetId: string };

const editableVariantFields = new Set(["postType", "caption", "openingHook", "hashtags", "callToAction", "destinationLink", "altText", "onScreenText", "videoConcept", "suggestedCover", "platformNotes", "internalNotes", "aiMetadata"]);

export async function updateVariantContent(input: {
  variantId: string; workspaceId: string; actorId: string; actorSessionVersion: number;
  expectedContentVersion: number; data: Record<string, unknown>; change?: SocialContentChange;
}) {
  if (Object.keys(input.data).some((key) => !editableVariantFields.has(key))) throw new Error("INVALID_SOCIAL_CONTENT");
  const imageScope = input.change?.kind === "AI_IMAGE" ? await getBlogOwnershipScope(input.workspaceId) : null;
  return prisma.$transaction(async (tx) => {
    await requireLockedWorkspaceEditor(tx, { userId: input.actorId, workspaceId: input.workspaceId, sessionVersion: input.actorSessionVersion });
    // Lock existing jobs before the variant, matching the publisher's completion
    // order. A claimed/provider-submitted job must settle before content changes.
    await tx.$queryRaw`SELECT j.id FROM "SocialPublishingJob" j JOIN "SocialVariant" v ON v.id=j."variantId" JOIN "SocialCampaign" c ON c.id=v."campaignId" WHERE v.id=${input.variantId} AND c."workspaceId"=${input.workspaceId} ORDER BY j.id FOR UPDATE OF j`;
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT v.id FROM "SocialVariant" v JOIN "SocialCampaign" c ON c.id=v."campaignId" WHERE v.id=${input.variantId} AND c."workspaceId"=${input.workspaceId} FOR UPDATE OF v`;
    if (!locked.length) throw new Error("SOCIAL_VARIANT_NOT_FOUND");
    const where = { id: input.variantId, campaign: { workspaceId: input.workspaceId } };
    const current = await tx.socialVariant.findFirstOrThrow({ where, select: { id: true, campaignId: true, status: true, contentVersion: true } });
    if (current.contentVersion !== input.expectedContentVersion) throw new Error("SOCIAL_EDIT_CONFLICT");
    const status = contentEditState(current.status as VariantState);
    const executing = await tx.socialPublishingJob.findFirst({
      where: { variantId: input.variantId, variant: { campaign: { workspaceId: input.workspaceId } }, OR: [{ claimToken: { not: null } }, { status: { in: ["VALIDATING", "PUBLISHING", "PROVIDER_PROCESSING", "MANUAL_FALLBACK", "TRANSFERRED_AS_DRAFT", "REQUIRES_MANUAL_COMPLETION"] } }] }, select: { id: true },
    });
    if (executing) throw new Error("SOCIAL_PUBLICATION_IN_PROGRESS");
    const data = { ...input.data };
    if (input.change?.kind === "MEDIA_PRESENTATION") {
      const changed = await tx.socialVariantMedia.updateMany({
        where: { id: input.change.relationId, variantId: input.variantId, variant: { campaign: { workspaceId: input.workspaceId } }, media: { project: { workspaceId: input.workspaceId } } },
        data: input.change.data,
      });
      if (changed.count !== 1) throw new Error("INVALID_SOCIAL_MEDIA");
    } else if (input.change?.kind === "MEDIA_SELECTION") {
      const mediaIds = input.change.mediaIds;
      if (new Set(mediaIds).size !== mediaIds.length) throw new Error("INVALID_SOCIAL_MEDIA");
      const valid = await tx.media.findMany({ where: { id: { in: mediaIds }, visibility: "VISIBLE", project: { workspaceId: input.workspaceId } }, select: { id: true, altText: true } });
      if (valid.length !== mediaIds.length) throw new Error("INVALID_SOCIAL_MEDIA");
      const byId = new Map(valid.map((item) => [item.id, item]));
      await tx.socialVariantMedia.deleteMany({ where: { variantId: input.variantId, variant: { campaign: { workspaceId: input.workspaceId } } } });
      if (mediaIds.length) {
        await tx.socialVariantMedia.createMany({ data: mediaIds.map((mediaId, displayOrder) => ({ variantId: input.variantId, mediaId, displayOrder, altText: byId.get(mediaId)!.altText })) });
        await tx.socialCampaignMedia.createMany({ data: mediaIds.map((mediaId, displayOrder) => ({ campaignId: current.campaignId, mediaId, displayOrder })), skipDuplicates: true });
      }
    } else if (input.change?.kind === "AI_IMAGE") {
      const asset = await tx.newsletterImageAsset.findFirst({ where: { id: input.change.assetId, AND: [imageScope!] }, select: { id: true, publicUrl: true, model: true } });
      if (!asset) throw new Error("SOCIAL_IMAGE_NOT_FOUND");
      await tx.socialGeneratedAsset.create({ data: { workspaceId: input.workspaceId, variantId: input.variantId, kind: "AI_GENERATED", publicUrl: asset.publicUrl, provider: "OpenAI", model: asset.model, disclosure: "AI-generated concept image, not authentic property photography." } });
      data.suggestedCover = asset.publicUrl;
      data.aiMetadata = { generatedImageAssetId: asset.id, generatedImageDisclosure: "AI-generated image; never represent it as authentic property photography." };
    }
    const variant = await tx.socialVariant.update({
      where: { ...where, contentVersion: input.expectedContentVersion },
      data: { ...data, status, lastEditedById: input.actorId, contentVersion: { increment: 1 }, approvedAt: null, approvalActorId: null },
    });
    await tx.socialPublishingSnapshot.updateMany({ where: { variantId: input.variantId, variant: { campaign: { workspaceId: input.workspaceId } }, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    await tx.socialPublishingJob.updateMany({
      where: { variantId: input.variantId, variant: { campaign: { workspaceId: input.workspaceId } }, status: { in: ["SCHEDULED", "READY", "DELAYED", "RETRY_SCHEDULED"] }, claimToken: null },
      data: { status: "CANCELLED", cancelledAt: new Date(), lastErrorCategory: "CANCELLED", lastErrorMessage: "Publishable content changed after approval." },
    });
    if (status === "NEEDS_REVIEW" && current.status !== "NEEDS_REVIEW") await tx.socialApprovalEvent.create({ data: { variantId: input.variantId, actorId: input.actorId, action: "REVOKED", contentVersion: current.contentVersion + 1, reason: "Publishable content or media changed." } });
    await tx.socialCampaign.update({ where: { id: current.campaignId, workspaceId: input.workspaceId }, data: { status: "IN_PROGRESS", lastEditedById: input.actorId } });
    return variant;
  });
}

export async function processDueSocialVariants(now = new Date()) {
  const due = await prisma.socialVariant.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true },
    take: 100,
  });
  let ready = 0;
  for (const item of due) {
    const updated = await prisma.socialVariant.updateMany({
      where: { id: item.id, status: "SCHEDULED", scheduledAt: { lte: now }, readyProcessedAt: null },
      data: { status: "READY_TO_PUBLISH", readyProcessedAt: now },
    });
    ready += updated.count;
  }
  return { inspected: due.length, ready, timeZone: SOCIAL_TIME_ZONE };
}
