import "server-only";

import { prisma } from "@/lib/prisma";
import { createPublishingJob } from "@/lib/social/publishing";
import { ensureSocialSettings, verifiedProjectFacts } from "@/lib/social/studio";
import { sendAutopilotReviewEmail } from "@/lib/social/autopilot-email";
import { getAbsoluteUrl } from "@/lib/site";
import {
  AUTOPILOT_PLATFORMS,
  DEFAULT_AUTOPILOT_MIX,
  approvedQueueBridgeEnabled,
  autopilotInputDigest,
  autopilotRunKey,
  endOfSocialWeek,
  mayEnterExistingQueue,
  sanitizeAutopilotError,
  socialAutopilotEnabled,
  startOfSocialWeek,
} from "@/lib/social/autopilot-core";

const DEFAULT_DAYS = [1, 2, 4, 5];
const DEFAULT_TIMES = ["09:00", "11:00", "13:00", "10:00"];

type GeneratedPlan = {
  pillar: string;
  projectId: string;
  reasoning: string;
  suggestedDay: number;
  suggestedTime: string;
  platforms: Record<string, { caption: string; openingHook: string; hashtags: string[]; callToAction: string; altText: string }>;
};

const socialCopySchema = (hashtagLimit: number) => ({
  type: "object",
  additionalProperties: false,
  properties: {
    caption: { type: "string" },
    openingHook: { type: "string" },
    hashtags: { type: "array", items: { type: "string" }, maxItems: hashtagLimit },
    callToAction: { type: "string" },
    altText: { type: "string" },
  },
  required: ["caption", "openingHook", "hashtags", "callToAction", "altText"],
});

const weeklyPlanSchema = (postsPerWeek: number, hashtagLimit: number, platforms: string[]) => ({
  type: "object",
  additionalProperties: false,
  properties: {
    plans: {
      type: "array",
      minItems: postsPerWeek,
      maxItems: postsPerWeek,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pillar: { type: "string" },
          projectId: { type: "string" },
          reasoning: { type: "string" },
          suggestedDay: { type: "integer", minimum: 0, maximum: 6 },
          suggestedTime: { type: "string" },
          platforms: {
            type: "object",
            additionalProperties: false,
            properties: Object.fromEntries(platforms.map((platform) => [platform, socialCopySchema(hashtagLimit)])),
            required: platforms,
          },
        },
        required: ["pillar", "projectId", "reasoning", "suggestedDay", "suggestedTime", "platforms"],
      },
    },
  },
  required: ["plans"],
});

const safeProviderField = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : undefined;

const jsonArray = (value: unknown, fallback: unknown[]) => Array.isArray(value) ? value : fallback;
const jsonObject = (value: unknown, fallback: Record<string, unknown>) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fallback;
const clean = (value: unknown, max = 4_000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function ensureAutopilotSettings(workspaceId: string) {
  return prisma.socialAutopilotSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      enabledPlatforms: [...AUTOPILOT_PLATFORMS],
      preferredPublishingDays: DEFAULT_DAYS,
      preferredTimeWindows: DEFAULT_TIMES,
      contentMix: DEFAULT_AUTOPILOT_MIX,
      notificationRecipients: [],
      reminderHours: [24, 48],
      contentCooldowns: { projectDays: 45, topicDays: 21 },
      callsToAction: [],
      exclusions: [],
    },
    update: {},
  });
}

function scheduledAt(weekStart: Date, day: number, time: string) {
  const target = new Date(weekStart);
  target.setUTCDate(target.getUTCDate() + Math.max(0, Math.min(6, day)));
  const [hour, minute] = time.split(":").map(Number);
  target.setUTCHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
  return target;
}

async function eligiblePortfolio(workspaceId: string, take: number) {
  const recent = await prisma.socialCampaign.findMany({
    where: { workspaceId, autopilotDraft: { isNot: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { sourceProjectId: true },
  });
  const used = new Set(recent.map((item) => item.sourceProjectId).filter(Boolean));
  const projects = await prisma.project.findMany({
    where: { workspaceId, status: "PUBLISHED", archivedAt: null },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
    take: Math.max(24, take * 6),
    include: {
      socialImageMedia: true,
      media: { where: { visibility: "VISIBLE" }, orderBy: { displayOrder: "asc" }, take: 12 },
    },
  });
  return projects
    .map((project) => ({
      project,
      media: project.socialImageMedia || project.media.find((item) => item.mimeType?.startsWith("image/") || item.sourceType === "UPLOADED_IMAGE") || null,
    }))
    .filter((item) => item.media)
    .sort((a, b) => Number(used.has(a.project.id)) - Number(used.has(b.project.id)))
    .slice(0, take);
}

async function requestPlans(input: {
  postsPerWeek: number;
  platforms: string[];
  portfolio: Array<{ id: string; facts: unknown }>;
  voice: string;
  guardrails: string;
  mix: unknown;
  market: string | null;
  hashtagLimit: number;
  days: number[];
  times: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("AI writing is not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_SOCIAL_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini",
      instructions: `Create a review-only weekly social plan. Use only supplied verified facts. Never invent property details, results, statistics, testimonials, trends, or claims. Voice: ${input.voice}. Guardrails: ${input.guardrails}.`,
      input: JSON.stringify({
        task: `Return exactly ${input.postsPerWeek} post concepts. Each concept needs distinct FACEBOOK and INSTAGRAM copy when those platforms are enabled.`,
        enabledPlatforms: input.platforms,
        contentMix: input.mix,
        geographicMarket: input.market,
        hashtagLimit: input.hashtagLimit,
        allowedDays: input.days,
        allowedTimes: input.times,
        verifiedPortfolio: input.portfolio,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "social_autopilot_week",
          strict: true,
          schema: weeklyPlanSchema(input.postsPerWeek, input.hashtagLimit, input.platforms),
        },
      },
    }),
    signal: AbortSignal.timeout(80_000),
  });
  if (!response.ok) {
    let providerError: { error?: { code?: unknown; type?: unknown } } = {};
    try {
      providerError = await response.json() as typeof providerError;
    } catch {
      // A provider error response is not guaranteed to contain JSON.
    }
    console.error("Social Autopilot provider request failed", {
      status: response.status,
      code: safeProviderField(providerError.error?.code),
      type: safeProviderField(providerError.error?.type),
      requestId: safeProviderField(response.headers.get("x-request-id")),
    });
    throw new Error(`AI generation was rejected (${response.status}). No drafts were created.`);
  }
  const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const output = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "{}";
  const parsed = JSON.parse(output) as { plans?: GeneratedPlan[] };
  if (!Array.isArray(parsed.plans) || parsed.plans.length !== input.postsPerWeek) throw new Error("AI returned an incomplete weekly plan.");
  return parsed.plans;
}

export async function generateAutopilotWeek(input: { workspaceId: string; actorId: string; trigger: "MANUAL" | "SCHEDULED"; now?: Date }) {
  if (!socialAutopilotEnabled()) throw new Error("Social autopilot generation is disabled.");
  const now = input.now || new Date();
  const settings = await ensureAutopilotSettings(input.workspaceId);
  if (!settings.enabled && input.trigger === "SCHEDULED") throw new Error("Scheduled social autopilot is disabled for this workspace.");
  const weekStart = startOfSocialWeek(now, settings.timeZone);
  const weekEnd = endOfSocialWeek(weekStart);
  const runKey = autopilotRunKey(input.workspaceId, weekStart);
  const existing = await prisma.socialAutopilotRun.findUnique({ where: { idempotencyKey: runKey }, include: { week: true } });
  if (existing?.status === "SUCCEEDED" && existing.week) return { week: existing.week, duplicate: true };

  const platforms = jsonArray(settings.enabledPlatforms, [...AUTOPILOT_PLATFORMS]).filter((item): item is string => typeof item === "string" && AUTOPILOT_PLATFORMS.includes(item as never));
  if (!platforms.length) throw new Error("Select at least one supported social platform.");
  const candidates = await eligiblePortfolio(input.workspaceId, settings.postsPerWeek);
  if (candidates.length < settings.postsPerWeek) throw new Error("Not enough published, visible portfolio media is available for this weekly plan.");
  const facts = await Promise.all(candidates.map(async ({ project }) => ({ id: project.id, facts: await verifiedProjectFacts(project.id, input.workspaceId) })));
  const studio = await ensureSocialSettings(input.workspaceId);
  const days = jsonArray(settings.preferredPublishingDays, DEFAULT_DAYS).map(Number).filter(Number.isFinite);
  const times = jsonArray(settings.preferredTimeWindows, DEFAULT_TIMES).map(String);
  const digest = autopilotInputDigest({ settings, projectIds: facts.map((item) => item.id), weekStart });

  const week = await prisma.socialAutopilotWeek.upsert({
    where: { workspaceId_weekStart: { workspaceId: input.workspaceId, weekStart } },
    create: { workspaceId: input.workspaceId, weekStart, weekEnd, inputDigest: digest, lockedAt: now, lockedBy: input.actorId },
    update: { status: "GENERATING", inputDigest: digest, lockedAt: now, lockedBy: input.actorId, lastErrorCode: null, lastErrorMessage: null },
  });
  const run = await prisma.socialAutopilotRun.upsert({
    where: { idempotencyKey: runKey },
    create: { workspaceId: input.workspaceId, weekId: week.id, idempotencyKey: runKey, trigger: input.trigger, status: "RUNNING", step: "AI_PLAN", attemptCount: 1, startedAt: now },
    update: { status: "RUNNING", step: "AI_PLAN", attemptCount: { increment: 1 }, startedAt: now, errorCode: null, errorMessage: null },
  });
  try {
    const plans = await requestPlans({ postsPerWeek: settings.postsPerWeek, platforms, portfolio: facts, voice: studio.brandVoice, guardrails: studio.writingGuardrails, mix: settings.contentMix, market: settings.geographicMarket, hashtagLimit: settings.hashtagLimit, days, times });
    const candidateById = new Map(candidates.map((item) => [item.project.id, item]));
    const normalized = plans.map((plan, index) => {
      const chosen = candidateById.get(plan.projectId) || candidates[index];
      const when = scheduledAt(weekStart, days.includes(Number(plan.suggestedDay)) ? Number(plan.suggestedDay) : (days[index % days.length] ?? index), times.includes(plan.suggestedTime) ? plan.suggestedTime : (times[index % times.length] || "09:00"));
      return { plan, chosen, when };
    });
    await prisma.$transaction(async (tx) => {
      await tx.socialAutopilotDraft.deleteMany({ where: { weekId: week.id, campaign: { variants: { none: { status: { in: ["APPROVED", "SCHEDULED", "READY_TO_PUBLISH", "PUBLISHED"] } } } } } });
      for (const { plan, chosen, when } of normalized) {
        const verifiedFacts = facts.find((item) => item.id === chosen.project.id)?.facts || {};
        const campaign = await tx.socialCampaign.create({
          data: {
            internalName: `Autopilot · ${chosen.project.title} · ${when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            purpose: clean(plan.reasoning, 2_000), status: "READY_FOR_REVIEW", sourceType: "PROJECT", sourceRecordIds: [chosen.project.id],
            verifiedSourceFacts: verifiedFacts, sourceProjectId: chosen.project.id, targetAudience: studio.primaryAudience, brandVoice: studio.brandVoice,
            objective: clean(plan.pillar, 160), desiredCallToAction: studio.defaultCallToAction, selectedPlatforms: platforms,
            scheduleNotes: "AI-suggested time only. Approval and queueing remain separate administrator actions.",
            createdById: input.actorId, lastEditedById: input.actorId, workspaceId: input.workspaceId,
            projects: { create: { projectId: chosen.project.id } },
            media: { create: { mediaId: chosen.media!.id, displayOrder: 0 } },
            variants: { create: platforms.map((platform) => {
              const draft = plan.platforms?.[platform] || {} as GeneratedPlan["platforms"][string];
              return {
                platform: platform as "FACEBOOK" | "INSTAGRAM", postType: platform === "INSTAGRAM" ? "SINGLE_IMAGE" : "IMAGE_POST",
                status: "NEEDS_REVIEW" as const, caption: clean(draft.caption, 5_000), openingHook: clean(draft.openingHook, 1_000),
                hashtags: jsonArray(draft.hashtags, []).filter((item): item is string => typeof item === "string").slice(0, settings.hashtagLimit),
                callToAction: clean(draft.callToAction, 1_000), altText: clean(draft.altText, 1_000), scheduledAt: when,
                scheduledTimeZone: settings.timeZone, lastEditedById: input.actorId,
                aiMetadata: { source: "SOCIAL_AUTOPILOT", reviewRequired: true, runId: run.id },
                media: { create: { mediaId: chosen.media!.id, displayOrder: 0, altText: clean(draft.altText, 1_000) } },
              };
            }) },
          },
          select: { id: true },
        });
        await tx.socialAutopilotDraft.create({ data: { weekId: week.id, campaignId: campaign.id, pillar: clean(plan.pillar, 120) || "PORTFOLIO_SPOTLIGHT", reasoning: clean(plan.reasoning, 2_000), sourceReferences: [chosen.project.id], suggestedAt: when } });
      }
      await tx.socialAutopilotWeek.update({ where: { id: week.id }, data: { status: "DRAFT_REVIEW_REQUIRED", lockedAt: null, lockedBy: null } });
      await tx.socialAutopilotRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", step: "COMPLETE", completedAt: new Date(), metadata: { draftsCreated: normalized.length } } });
    });
    const completedWeek = await prisma.socialAutopilotWeek.findUniqueOrThrow({ where: { id: week.id } });
    if (process.env.SOCIAL_WEEKLY_EMAIL_ENABLED === "true") {
      const recipients = jsonArray(settings.notificationRecipients, []).filter((item): item is string => typeof item === "string" && item.includes("@"));
      try {
        const notice = await sendAutopilotReviewEmail({
          recipients,
          weekLabel: `Week of ${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
          reviewUrl: getAbsoluteUrl("/admin/social-studio"),
        });
        if (notice.delivered) await prisma.socialAutopilotWeek.update({ where: { id: week.id }, data: { reviewNotifiedAt: new Date() } });
      } catch {
        // Notification failure must never remove or invalidate successfully generated drafts.
      }
    }
    return { week: completedWeek, duplicate: false };
  } catch (error) {
    const message = sanitizeAutopilotError(error);
    await prisma.$transaction([
      prisma.socialAutopilotWeek.update({ where: { id: week.id }, data: { status: "FAILED", lockedAt: null, lockedBy: null, lastErrorCode: "GENERATION_FAILED", lastErrorMessage: message } }),
      prisma.socialAutopilotRun.update({ where: { id: run.id }, data: { status: "FAILED", step: "FAILED", completedAt: new Date(), errorCode: "GENERATION_FAILED", errorMessage: message } }),
    ]);
    throw new Error(message);
  }
}

export async function queueApprovedAutopilotDraft(input: { workspaceId: string; draftId: string }) {
  if (!approvedQueueBridgeEnabled()) throw new Error("The approved-draft queue bridge is disabled.");
  const draft = await prisma.socialAutopilotDraft.findFirst({
    where: { id: input.draftId, week: { workspaceId: input.workspaceId } },
    include: { campaign: { include: { variants: true } } },
  });
  if (!draft) throw new Error("Autopilot draft not found.");
  if (draft.rejectedAt) throw new Error("Rejected autopilot drafts cannot enter the publishing queue.");
  const jobs = [];
  for (const variant of draft.campaign.variants) {
    if (!mayEnterExistingQueue({ variantStatus: variant.status, rejectedAt: draft.rejectedAt })) throw new Error("Every variant must be explicitly approved before queueing.");
    const connection = await prisma.socialConnection.findFirst({ where: { workspaceId: input.workspaceId, platform: variant.platform, state: "CONNECTED", directPublishingEnabled: true }, orderBy: { lastConnectionTestSuccessAt: "desc" } });
    if (!connection) throw new Error(`No active ${variant.platform} destination is available.`);
    jobs.push(await createPublishingJob({ variantId: variant.id, connectionId: connection.id }));
  }
  return jobs;
}

export function publicAutopilotSettings(settings: Awaited<ReturnType<typeof ensureAutopilotSettings>>) {
  return {
    enabled: settings.enabled, postsPerWeek: settings.postsPerWeek,
    enabledPlatforms: jsonArray(settings.enabledPlatforms, [...AUTOPILOT_PLATFORMS]),
    preferredPublishingDays: jsonArray(settings.preferredPublishingDays, DEFAULT_DAYS),
    preferredTimeWindows: jsonArray(settings.preferredTimeWindows, DEFAULT_TIMES),
    contentMix: jsonObject(settings.contentMix, { ...DEFAULT_AUTOPILOT_MIX }), portfolioFirst: settings.portfolioFirst,
    aiImagesEnabled: settings.aiImagesEnabled, externalResearchEnabled: settings.externalResearchEnabled,
    notificationRecipients: jsonArray(settings.notificationRecipients, []), generationDay: settings.generationDay,
    generationLocalTime: settings.generationLocalTime, timeZone: settings.timeZone, nextGenerationAt: settings.nextGenerationAt,
  };
}
