import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { normalizeAiCampaignBrief, platformPrompt, sanitizedVerifiedFacts, SOCIAL_PLATFORMS } from "@/lib/social/core";
import { deterministicallyGroundSocialDrafts, socialDraftText } from "@/lib/social/grounding";
import { ensureSocialSettings, updateVariantContent } from "@/lib/social/studio";
import { claimSocialGeneration, failSocialGeneration } from "@/lib/social/generation-ownership";
import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";

export const maxDuration = 120;

function safeGenerationError(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "AI verification timed out before the draft could be safely approved. Existing content was preserved. Please try again.";
  }
  if (!(error instanceof Error)) return "AI generation failed safely. Existing content was preserved.";
  if (error.message.includes("grounding review")) {
    return "AI verification could not validate the draft. Existing content was preserved. Please try again.";
  }
  if (error.message.includes("campaign brief")) {
    return "AI returned an incomplete campaign brief. Existing content was preserved. Please try again.";
  }
  if (error.message.includes("Social Studio generation")) {
    return "AI could not prepare the Social Studio draft. Existing content was preserved. Please try again.";
  }
  return "AI generation failed safely. Existing content was preserved. Please try again.";
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { campaignId?: string; variantId?: string; action?: string; requestId?: string; tone?: string };
  if (typeof body.campaignId !== "string" || !body.campaignId || body.campaignId.length > 100 || typeof body.requestId !== "string" || !body.requestId || body.requestId.length > 180 || (body.variantId !== undefined && (typeof body.variantId !== "string" || body.variantId.length > 100))) return NextResponse.json({ success: false, error: "Valid campaign and request IDs are required." }, { status: 400 });
  const workspaceId = session.workspaceId;
  const requestId = body.requestId;
  const campaignId = body.campaignId;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ success: false, error: "AI writing is not configured yet." }, { status: 503 });
  let claim: Awaited<ReturnType<typeof claimSocialGeneration>>;
  try {
    claim = await claimSocialGeneration(session, campaignId, requestId, body.variantId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Your workspace access changed. Sign in again." }, { status: 403 });
    if (["SOCIAL_CAMPAIGN_NOT_FOUND", "SOCIAL_VARIANT_NOT_FOUND"].includes(code)) return NextResponse.json({ success: false, error: "Campaign or variant not found." }, { status: 404 });
    if (code === "INVALID_SOCIAL_SOURCE") return NextResponse.json({ success: false, error: "Review the campaign source before generating content." }, { status: 409 });
    if (["SOCIAL_GENERATION_BUSY", "SOCIAL_GENERATION_LOCKED"].includes(code)) return NextResponse.json({ success: false, error: "Generation is already running, or the selected posts cannot be edited." }, { status: 409 });
    return NextResponse.json({ success: false, error: "AI generation could not be prepared." }, { status: 500 });
  }
  if (claim.duplicate) return NextResponse.json({ success: true, duplicate: true });
  const { campaign, chosen } = claim;
  try {
    const settings = await ensureSocialSettings(workspaceId);
    const company = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true } });
    const platforms = chosen.map((variant) => variant.platform).filter((platform) => SOCIAL_PLATFORMS.includes(platform));
    const savedPlatformGuidance = settings.platformGuidance && typeof settings.platformGuidance === "object" && !Array.isArray(settings.platformGuidance)
      ? settings.platformGuidance as Record<string, unknown>
      : {};
    const facts = sanitizedVerifiedFacts(campaign.verifiedSourceFacts);
    const action = body.action || "create-platform-variants";
    const prompt = [
      `Create distinct social drafts for: ${platforms.join(", ")}.`,
      `Campaign objective: ${campaign.objective || "brand awareness"}.`,
      `Audience: ${campaign.targetAudience || settings.primaryAudience}.`,
      `Primary message: ${campaign.primaryMessage || "Show only the verified source and the value of professional real estate media"}.`,
      `Call to action: ${campaign.desiredCallToAction || settings.defaultCallToAction || "None supplied"}.`,
      `Tone adjustment: ${body.tone || "Use Social Studio Voice"}.`,
      `Requested operation: ${action}.`,
      `VERIFIED FACTS (the only facts you may state): ${JSON.stringify(facts)}.`,
      "Property-specific attributes must be supported by a non-empty VERIFIED FACTS key. If a detail is absent, do not infer it from the title, location, media, or campaign direction.",
      "Fact roles are strict: listingAgent is the listing agent; brokerage is the listing brokerage; projectType is the Helios project category. Never describe the brokerage or listing agent as the media creator. Never include database IDs, source IDs, slugs, field names, or phrases such as verified source in publishable copy.",
      `Internal creative instructions, never quote as facts: ${campaign.internalAiInstructions || "None"}.`,
      ...platforms.map((platform) => {
        const savedGuidance = savedPlatformGuidance[platform];
        return `${platform}: ${platformPrompt(platform)} Saved administrator guidance: ${typeof savedGuidance === "string" && savedGuidance.trim() ? savedGuidance.trim() : "None supplied"}.`;
      }),
      "Return one JSON object with a campaignBrief object and one object keyed by each requested platform.",
      "campaignBrief must contain positioning, themes array, cadence, formats array, platformConsiderations, and callsToAction.",
      "Each platform object must contain caption, openingHook, hashtags array, callToAction, onScreenText, videoConcept, and altText. Never approve, schedule, publish, invent a link, or claim performance.",
    ].join("\n");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SOCIAL_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini",
        instructions: `You are Social Studio for ${company.name}. Voice: ${settings.brandVoice}. Guardrails: ${settings.writingGuardrails}. Hashtag guidance: ${settings.hashtagGuidance || ""}. Prohibited: ${settings.prohibitedTopics || ""}`,
        input: prompt, text: { format: { type: "json_object" } },
      }),
      signal: AbortSignal.timeout(70_000),
    });
    if (!response.ok) throw new Error(`OpenAI rejected Social Studio generation (${response.status}).`);
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const output = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "{}";
    const drafts = JSON.parse(output) as Record<string, Record<string, unknown>>;
    const stringField = { type: "string" } as const;
    const stringArray = { type: "array", items: stringField } as const;
    const platformDraftSchema = {
      type: "object",
      properties: {
        caption: stringField, openingHook: stringField, hashtags: stringArray,
        callToAction: stringField, onScreenText: stringField,
        videoConcept: stringField, altText: stringField,
      },
      required: ["caption", "openingHook", "hashtags", "callToAction", "onScreenText", "videoConcept", "altText"],
      additionalProperties: false,
    } as const;
    const platformProperties = Object.fromEntries(platforms.map((platform) => [platform, platformDraftSchema]));
    const groundingResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SOCIAL_GROUNDING_MODEL?.trim() || "gpt-4.1-mini",
        instructions: "Rewrite the generated Social Studio draft so every factual statement is supported by a non-empty supplied verified fact. Remove every unsupported property attribute, amenity, size, design detail, result, client detail, or service claim. Generic creative recommendations may remain only when they do not describe the property as fact. Never infer facts from names, images, campaign direction, or empty fields. Never expose IDs, slugs, field names, or verification metadata. Treat listingAgent as the listing agent and brokerage as the listing brokerage, never as the media creator. Return only the corrected draft in the required schema.",
        input: [
          `VERIFIED FACTS: ${JSON.stringify(facts)}`,
          `GENERATED SOCIAL CONTENT:\n${socialDraftText(drafts)}`,
          "Return a fully corrected campaign brief and corrected platform drafts. Also list the unsupported claims you removed. An empty facts field never supports a claim.",
        ].join("\n\n"),
        text: {
          format: {
            type: "json_schema",
            name: "social_grounded_drafts",
            strict: true,
            schema: {
              type: "object",
              properties: {
                campaignBrief: {
                  type: "object",
                  properties: {
                    positioning: stringField, themes: stringArray, cadence: stringField,
                    formats: stringArray, platformConsiderations: stringField, callsToAction: stringField,
                  },
                  required: ["positioning", "themes", "cadence", "formats", "platformConsiderations", "callsToAction"],
                  additionalProperties: false,
                },
                platforms: {
                  type: "object",
                  properties: platformProperties,
                  required: platforms,
                  additionalProperties: false,
                },
                unsupportedClaims: { type: "array", items: { type: "string" } },
              },
              required: ["campaignBrief", "platforms", "unsupportedClaims"],
              additionalProperties: false,
            },
          },
        },
        max_output_tokens: 2500,
      }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!groundingResponse.ok) throw new Error(`OpenAI rejected Social Studio grounding review (${groundingResponse.status}).`);
    const groundingResult = await groundingResponse.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const groundingOutput = groundingResult.output_text || groundingResult.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "{}";
    const groundedResult = JSON.parse(groundingOutput) as {
      campaignBrief?: Record<string, unknown>;
      platforms?: Record<string, Record<string, unknown>>;
      unsupportedClaims?: string[];
    };
    const correctedDrafts: Record<string, Record<string, unknown>> = {
      campaignBrief: groundedResult.campaignBrief || {},
      ...(groundedResult.platforms || {}),
    };
    const { value: groundedDrafts } = deterministicallyGroundSocialDrafts(correctedDrafts, facts);
    const brief = normalizeAiCampaignBrief(groundedDrafts.campaignBrief);
    if (!brief || platforms.some((platform) => !groundedDrafts[platform])) throw new Error("OpenAI returned an invalid grounding review.");
    await prisma.$transaction(async (tx) => {
      await requireLockedWorkspaceEditor(tx, session);
      const current = await tx.socialCampaign.findFirst({ where: { id: campaign.id, workspaceId, generationRequestId: requestId, generationStatus: "RUNNING", status: { not: "ARCHIVED" } }, select: { id: true } });
      if (!current) throw new Error("SOCIAL_GENERATION_CONFLICT");
      for (const variant of chosen) {
        const draft = groundedDrafts[variant.platform] || {};
        await updateVariantContent({
          variantId: variant.id, workspaceId, actorId: session.userId, actorSessionVersion: session.sessionVersion, expectedContentVersion: variant.contentVersion,
          data: {
            caption: String(draft.caption || variant.caption || ""), openingHook: String(draft.openingHook || variant.openingHook || ""),
            hashtags: Array.isArray(draft.hashtags) ? draft.hashtags.slice(0, 30) as Prisma.InputJsonValue : variant.hashtags || [],
            callToAction: String(draft.callToAction || variant.callToAction || ""), onScreenText: String(draft.onScreenText || variant.onScreenText || ""),
            videoConcept: String(draft.videoConcept || variant.videoConcept || ""), altText: String(draft.altText || variant.altText || ""),
            aiMetadata: { requestId: requestId, action, model: process.env.OPENAI_SOCIAL_MODEL || process.env.OPENAI_BLOG_MODEL || "gpt-5-mini", generatedAt: new Date().toISOString(), sourceCampaignId: campaign.id },
          },
        }, tx);
      }
      await tx.socialCampaign.update({
        where: { id: campaign.id, workspaceId, generationRequestId: requestId, generationStatus: "RUNNING" },
        data: {
          purpose: [
            brief.positioning,
            brief.themes.length ? `Content themes: ${brief.themes.join("; ")}` : "",
            brief.cadence ? `Recommended cadence: ${brief.cadence}` : "",
            brief.formats.length ? `Suggested formats: ${brief.formats.join("; ")}` : "",
            brief.platformConsiderations ? `Platform considerations: ${brief.platformConsiderations}` : "",
            brief.callsToAction ? `Calls to action: ${brief.callsToAction}` : "",
          ].filter(Boolean).join("\n\n"),
          generationStatus: "SUCCEEDED",
          generationError: null,
          lastEditedById: session.userId,
        },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    await failSocialGeneration(workspaceId, campaign.id, requestId, safeGenerationError(error));
    const code = error instanceof Error ? error.message : "";
    const status = code === "WORKSPACE_WRITE_FORBIDDEN" ? 403 : ["SOCIAL_EDIT_CONFLICT", "SOCIAL_GENERATION_CONFLICT", "SOCIAL_PUBLICATION_IN_PROGRESS"].includes(code) ? 409 : 502;
    return NextResponse.json({ success: false, error: safeGenerationError(error) }, { status });
  }
}
