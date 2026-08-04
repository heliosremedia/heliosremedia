import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { LOCATION_FIELD_LIMITS, normalizeAiDraft } from "@/lib/location-page-content";
import { prisma } from "@/lib/prisma";

const LOCATION_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    heroLead: { type: "string", maxLength: LOCATION_FIELD_LIMITS.heroLead },
    introduction: { type: "string", maxLength: LOCATION_FIELD_LIMITS.introduction },
    marketTitle: { type: "string", maxLength: LOCATION_FIELD_LIMITS.marketTitle },
    marketCopy: { type: "string", maxLength: LOCATION_FIELD_LIMITS.marketCopy },
    ctaHeadline: { type: "string", maxLength: LOCATION_FIELD_LIMITS.ctaHeadline },
    seoTitle: { type: "string", maxLength: LOCATION_FIELD_LIMITS.seoTitle },
    seoDescription: { type: "string", maxLength: LOCATION_FIELD_LIMITS.seoDescription },
    featureImageAlt: { type: "string", maxLength: LOCATION_FIELD_LIMITS.featureImageAlt },
  },
  required: ["heroLead", "introduction", "marketTitle", "marketCopy", "ctaHeadline", "seoTitle", "seoDescription", "featureImageAlt"],
  additionalProperties: false,
} as const;

function safeText(value: unknown, limit: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > limit) throw new Error("INVALID_INPUT");
  return text;
}

function providerError(status: number) {
  if (status === 429) return "The writing assistant is busy. Wait a moment, then retry.";
  if (status >= 500) return "The writing assistant is temporarily unavailable. Try again shortly.";
  return "The writing assistant could not create a usable draft. Review the AI configuration and retry.";
}

const GENERIC_LOCATION_PHRASES = [
  "unique character", "vibrant community", "something for everyone",
  "desirable place to live", "perfect blend", "hidden gem",
];

function directionKeywords(direction: string) {
  const ignored = new Set([
    "about", "also", "and", "being", "city", "cover", "describe", "focus", "from",
    "have", "history", "into", "local", "make", "more", "page", "that", "their",
    "this", "town", "with", "write",
  ]);
  return [...new Set(direction.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [])]
    .filter((word) => !ignored.has(word))
    .slice(0, 10);
}

function draftQualityIssues(draft: Partial<Record<string, string>>, city: string, customDirection: string) {
  const combined = `${draft.introduction || ""} ${draft.marketCopy || ""}`.toLowerCase();
  const issues: string[] = [];
  if ((draft.marketCopy || "").length < 900) issues.push("Market Story must be 900 to 1,400 characters.");
  if (!combined.includes(city.toLowerCase())) issues.push(`Name ${city} naturally in the location-led copy.`);
  if (GENERIC_LOCATION_PHRASES.filter((phrase) => combined.includes(phrase)).length > 1) {
    issues.push("Replace generic destination language with concrete local character.");
  }
  const required = directionKeywords(customDirection);
  const covered = required.filter((keyword) => combined.includes(keyword));
  const minimum = Math.min(required.length, Math.max(1, Math.ceil(required.length * 0.6)));
  if (required.length && covered.length < minimum) {
    issues.push(`Meaningfully develop the supplied direction, including: ${required.join(", ")}.`);
  }
  return issues;
}

async function createLocationDraft(apiKey: string, model: string, instructions: string, facts: object) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions,
      input: JSON.stringify(facts),
      text: {
        format: {
          type: "json_schema",
          name: "location_page_draft",
          strict: true,
          schema: LOCATION_DRAFT_SCHEMA,
        },
      },
      max_output_tokens: 6_000,
    }),
    signal: AbortSignal.timeout(60_000),
  });
}

async function logProviderRejection(response: Response, model: string) {
  let details: { error?: { code?: unknown; type?: unknown; param?: unknown } } = {};
  try {
    details = await response.clone().json() as typeof details;
  } catch {
    // The provider may return a non-JSON error page. Do not log its body.
  }
  console.error("Location Page AI provider rejection", {
    status: response.status,
    model,
    code: typeof details.error?.code === "string" ? details.error.code : undefined,
    type: typeof details.error?.type === "string" ? details.error.type : undefined,
    param: typeof details.error?.param === "string" ? details.error.param : undefined,
  });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const locationId = safeText(body.locationId, 100);
    const customDirection = safeText(body.customDirection, LOCATION_FIELD_LIMITS.customDirection);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ success: false, error: "AI writing is not configured yet." }, { status: 503 });

    const [location, settings, services, projects] = await Promise.all([
      prisma.locationPage.findFirst({ where: { id: locationId, workspaceId: session.workspaceId } }),
      prisma.siteSettings.findFirst({ where: { workspaceId: session.workspaceId }, select: { businessName: true, serviceArea: true, brandVoice: true, brandAudience: true, brandWritingGuidance: true } }),
      prisma.service.findMany({ where: { workspaceId: session.workspaceId, active: true, archivedAt: null }, orderBy: { displayOrder: "asc" }, select: { name: true, description: true } }),
      prisma.project.findMany({
        where: { workspaceId: session.workspaceId, status: "PUBLISHED", OR: [{ city: { equals: safeText(body.city, 100), mode: "insensitive" } }, { locationLabel: { contains: safeText(body.city, 100), mode: "insensitive" } }] },
        take: 12,
        orderBy: { publishedAt: "desc" },
        select: { title: true, city: true, state: true, locationLabel: true, propertyType: true, shortDescription: true },
      }),
    ]);
    if (!location || !settings) return NextResponse.json({ success: false, error: "Location page not found." }, { status: 404 });

    const current = {
      heroLead: location.heroLead, introduction: location.introduction, marketTitle: location.marketTitle,
      marketCopy: location.marketCopy, ctaHeadline: location.ctaHeadline, seoTitle: location.seoTitle,
      seoDescription: location.seoDescription, featureImageAlt: location.featureImageAlt,
    };
    const facts = {
      location: { city: location.city, state: location.state, county: location.county, serviceArea: location.serviceArea, localDetails: location.localDetails },
      company: settings,
      activeServices: services,
      publishedProjects: projects,
      currentContent: current,
      hasFeatureImage: Boolean(location.featureImageStorageKey || location.featureImageUrl),
      customDirection: customDirection || null,
    };
    const instructions = `You are the location-page writing assistant for ${settings.businessName}. Create a complete draft with heroLead, introduction, marketTitle, marketCopy, ctaHeadline, seoTitle, seoDescription, and featureImageAlt. If there is no feature image, return an empty string for featureImageAlt.

CONTENT PRIORITY
1. The location's identity, history, landscape, culture, neighborhoods, architecture, and everyday character lead the story.
2. When customDirection is supplied, treat every requested subject as a firm creative requirement. Develop it with substance across the introduction and Market Story. Do not merely mention its keywords.
3. Helios and its services are supporting context only. Do not turn the page into a list of deliverables.

LOCAL DEPTH
Use the supplied facts. You may also use stable, widely known geographic, cultural, historical, institutional, architectural, and lifestyle context about the named city. Do not guess obscure facts or use current statistics, rankings, superlatives, market conditions, awards, reviews, offices, or unsupported service claims. Include several concrete local references naturally. The copy must fail the city-swap test: replacing the city name with another city must make the writing visibly wrong.

FIELD DIRECTION
- heroLead: concise, evocative, and place-specific.
- introduction: one or two polished paragraphs establishing the city's identity before mentioning Helios.
- marketTitle: editorial and specific to the local angle.
- marketCopy: 900 to 1,400 characters in two to four natural paragraphs. Develop the requested themes with genuine depth and keep Helios secondary.
- ctaHeadline: refined and connected to the place, without generic sales hype.
- SEO fields: accurate, natural, and locally relevant without keyword stuffing.

Write premium, calm, human copy in the company's voice. Do not use em dashes, hype, generic destination filler, or interchangeable structure. Use blank lines between paragraphs. Observe every schema limit. The content is a reviewable draft, never a publication instruction.`;
    const configuredModel = process.env.OPENAI_LOCATION_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini";
    const models = configuredModel === "gpt-5-mini" ? [configuredModel] : [configuredModel, "gpt-5-mini"];
    const attemptModels = [...models, "gpt-5-mini"];
    let response: Response | null = null;
    let qualityFeedback: string[] = [];

    for (const [index, model] of attemptModels.entries()) {
      response = await createLocationDraft(apiKey, model, instructions, {
        ...facts,
        qualityFeedback: qualityFeedback.length ? qualityFeedback : null,
      });
      if (response.ok) {
        try {
          const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
          const output = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "{}";
          const draft = normalizeAiDraft(JSON.parse(output), facts.hasFeatureImage);
          qualityFeedback = draftQualityIssues(draft, location.city, customDirection);
          if (!qualityFeedback.length) return NextResponse.json({ success: true, draft });
          console.error("Location Page AI draft failed quality gate", { model, issues: qualityFeedback });
        } catch {
          qualityFeedback = ["Return a complete valid structured draft with all eight required fields."];
        }
        if (index < attemptModels.length - 1) continue;
        return NextResponse.json({ success: false, error: "The assistant returned copy that was not local or detailed enough. Please retry." }, { status: 502 });
      }
      await logProviderRejection(response, model);
      const canRetryWithFallback = index < attemptModels.length - 1 && [400, 404, 422].includes(response.status);
      if (!canRetryWithFallback) break;
    }

    if (!response || !response.ok) {
      const status = response?.status || 502;
      return NextResponse.json({ success: false, error: providerError(status) }, { status: status >= 500 ? 502 : status });
    }
    return NextResponse.json({ success: false, error: "The assistant returned copy that was not local or detailed enough. Please retry." }, { status: 502 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_INPUT") return NextResponse.json({ success: false, error: "Custom direction must be 1,200 characters or fewer." }, { status: 400 });
    console.error("Location Page AI request failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ success: false, error: "The assistant did not return a valid draft within the field limits. Retry or adjust the direction." }, { status: 502 });
  }
}
