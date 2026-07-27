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

export async function ensureSocialSettings() {
  return prisma.socialStudioSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...SOCIAL_SETTINGS_DEFAULTS },
    update: {},
  });
}

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
  return JSON.parse(JSON.stringify(project)) as Prisma.InputJsonValue;
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
