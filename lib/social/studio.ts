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

export async function verifiedProjectFacts(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
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

export async function verifiedSourceFacts(sourceType: string, sourceRecordId: string) {
  if (sourceType === "PROJECT" || sourceType === "PORTFOLIO_ITEM") return verifiedProjectFacts(sourceRecordId);
  if (sourceType === "BLOG") {
    const post = await prisma.blogPost.findFirst({
      where: { id: sourceRecordId, status: "PUBLISHED" },
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
      where: { id: sourceRecordId, status: "SENT" },
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

export async function updateVariantContent(input: {
  variantId: string;
  actorId: string;
  data: Record<string, unknown>;
}) {
  const current = await prisma.socialVariant.findUniqueOrThrow({
    where: { id: input.variantId },
    select: { status: true, contentVersion: true },
  });
  const status = contentEditState(current.status as VariantState);
  return prisma.$transaction(async (tx) => {
    const variant = await tx.socialVariant.update({
      where: { id: input.variantId },
      data: {
        ...input.data,
        status,
        lastEditedById: input.actorId,
        contentVersion: { increment: 1 },
        ...(status === "NEEDS_REVIEW" ? { approvedAt: null, approvalActorId: null } : {}),
      },
    });
    if (status === "NEEDS_REVIEW" && current.status !== "NEEDS_REVIEW") {
      await tx.socialPublishingSnapshot.updateMany({
        where: { variantId: input.variantId, invalidatedAt: null },
        data: { invalidatedAt: new Date() },
      });
      await tx.socialPublishingJob.updateMany({
        where: { variantId: input.variantId, status: { in: ["SCHEDULED", "VALIDATING", "READY", "DELAYED", "RETRY_SCHEDULED"] } },
        data: { status: "CANCELLED", cancelledAt: new Date(), claimToken: null, lastErrorCategory: "CANCELLED", lastErrorMessage: "Publishable content changed after approval." },
      });
      await tx.socialApprovalEvent.create({
        data: {
          variantId: input.variantId, actorId: input.actorId, action: "REVOKED",
          contentVersion: current.contentVersion + 1, reason: "Publishable content or media changed.",
        },
      });
    }
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
