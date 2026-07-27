import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { platformPrompt, sanitizedVerifiedFacts, SOCIAL_PLATFORMS } from "@/lib/social/core";
import { ensureSocialSettings } from "@/lib/social/studio";
import { requireWorkspaceId } from "@/lib/workspaces";

export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { campaignId?: string; variantId?: string; action?: string; requestId?: string; tone?: string };
  if (!body.campaignId || !body.requestId) return NextResponse.json({ success: false, error: "Campaign and request ID are required." }, { status: 400 });
  const workspaceId = await requireWorkspaceId(session.userId);
  const campaign = await prisma.socialCampaign.findFirst({ where: { id: body.campaignId, workspaceId }, include: { variants: true } });
  if (!campaign) return NextResponse.json({ success: false, error: "Campaign not found." }, { status: 404 });
  if (campaign.generationStatus === "RUNNING") return NextResponse.json({ success: false, error: "Generation is already in progress." }, { status: 409 });
  if (campaign.generationRequestId === body.requestId && campaign.generationStatus === "SUCCEEDED") return NextResponse.json({ success: true, duplicate: true });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ success: false, error: "AI writing is not configured yet." }, { status: 503 });
  await prisma.socialCampaign.update({ where: { id: campaign.id }, data: { generationStatus: "RUNNING", generationError: null, generationRequestId: body.requestId } });
  try {
    const settings = await ensureSocialSettings(workspaceId);
    const requested = body.variantId ? campaign.variants.filter((variant) => variant.id === body.variantId) : campaign.variants;
    const chosen = requested.filter((variant) => variant.status !== "PUBLISHED");
    if (!chosen.length) {
      await prisma.socialCampaign.update({ where: { id: campaign.id }, data: { generationStatus: "FAILED", generationError: "Published variants are immutable and cannot be regenerated." } });
      return NextResponse.json({ success: false, error: "Published variants are immutable. Create a new campaign or variant revision instead." }, { status: 409 });
    }
    const platforms = chosen.map((variant) => variant.platform).filter((platform) => SOCIAL_PLATFORMS.includes(platform));
    const savedPlatformGuidance = settings.platformGuidance && typeof settings.platformGuidance === "object" && !Array.isArray(settings.platformGuidance)
      ? settings.platformGuidance as Record<string, unknown>
      : {};
    const facts = sanitizedVerifiedFacts(campaign.verifiedSourceFacts);
    const action = body.action || "create-platform-variants";
    const prompt = [
      `Create distinct social drafts for: ${platforms.join(", ")}.`,
      `Campaign objective: ${campaign.objective || campaign.purpose || "brand awareness"}.`,
      `Audience: ${campaign.targetAudience || settings.primaryAudience}.`,
      `Primary message: ${campaign.primaryMessage || campaign.purpose || "Not supplied"}.`,
      `Call to action: ${campaign.desiredCallToAction || settings.defaultCallToAction || "None supplied"}.`,
      `Tone adjustment: ${body.tone || "Use Social Studio Voice"}.`,
      `Requested operation: ${action}.`,
      `VERIFIED FACTS (the only facts you may state): ${JSON.stringify(facts)}.`,
      `Internal creative instructions, never quote as facts: ${campaign.internalAiInstructions || "None"}.`,
      ...platforms.map((platform) => {
        const savedGuidance = savedPlatformGuidance[platform];
        return `${platform}: ${platformPrompt(platform)} Saved administrator guidance: ${typeof savedGuidance === "string" && savedGuidance.trim() ? savedGuidance.trim() : "None supplied"}.`;
      }),
      "Return one JSON object keyed by platform. Each platform object must contain caption, openingHook, hashtags array, callToAction, onScreenText, videoConcept, and altText. Never approve, schedule, publish, invent a link, or claim performance.",
    ].join("\n");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SOCIAL_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini",
        instructions: `You are Social Studio for Helios Real Estate Media. Voice: ${settings.brandVoice}. Guardrails: ${settings.writingGuardrails}. Hashtag guidance: ${settings.hashtagGuidance || ""}. Prohibited: ${settings.prohibitedTopics || ""}`,
        input: prompt, text: { format: { type: "json_object" } },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`OpenAI rejected Social Studio generation (${response.status}).`);
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const output = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "{}";
    const drafts = JSON.parse(output) as Record<string, Record<string, unknown>>;
    await prisma.$transaction(async (tx) => {
      for (const variant of chosen) {
        const draft = drafts[variant.platform] || {};
        await tx.socialVariant.update({
          where: { id: variant.id },
          data: {
            caption: String(draft.caption || variant.caption || ""), openingHook: String(draft.openingHook || variant.openingHook || ""),
            hashtags: Array.isArray(draft.hashtags) ? draft.hashtags.slice(0, 30) as Prisma.InputJsonValue : variant.hashtags || [],
            callToAction: String(draft.callToAction || variant.callToAction || ""), onScreenText: String(draft.onScreenText || variant.onScreenText || ""),
            videoConcept: String(draft.videoConcept || variant.videoConcept || ""), altText: String(draft.altText || variant.altText || ""),
            status: "DRAFT", aiMetadata: { requestId: body.requestId, action, model: process.env.OPENAI_SOCIAL_MODEL || process.env.OPENAI_BLOG_MODEL || "gpt-5-mini", generatedAt: new Date().toISOString(), sourceCampaignId: campaign.id },
            lastEditedById: session.userId, contentVersion: { increment: 1 },
          },
        });
      }
      await tx.socialCampaign.update({ where: { id: campaign.id }, data: { generationStatus: "SUCCEEDED", generationError: null } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    await prisma.socialCampaign.update({ where: { id: campaign.id }, data: { generationStatus: "FAILED", generationError: error instanceof Error ? error.message : "Generation failed." } });
    return NextResponse.json({ success: false, error: "AI generation failed safely. Existing content was preserved." }, { status: 502 });
  }
}
