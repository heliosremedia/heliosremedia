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
    const instructions = `You are the location-page writing assistant for ${settings.businessName}. Create a complete draft with heroLead, introduction, marketTitle, marketCopy, ctaHeadline, seoTitle, seoDescription, and featureImageAlt. If there is no feature image, return an empty string for featureImageAlt. Write premium, calm, locally specific, human copy in the company's voice. Treat customDirection as optional guidance: follow it when supplied, and otherwise generate the best complete draft from the supplied facts. Use only the supplied facts. Do not invent neighborhoods, landmarks, statistics, rankings, awards, reviews, offices, market claims, or service claims. Do not use em dashes, keyword stuffing, hype, or interchangeable city-name-swapped structure. Use natural paragraphs with blank lines where helpful. Observe the schema's hard character limits. The content is a reviewable draft, never a publication instruction.`;
    const configuredModel = process.env.OPENAI_LOCATION_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini";
    const models = configuredModel === "gpt-5-mini" ? [configuredModel] : [configuredModel, "gpt-5-mini"];
    let response: Response | null = null;

    for (const [index, model] of models.entries()) {
      response = await createLocationDraft(apiKey, model, instructions, facts);
      if (response.ok) break;
      await logProviderRejection(response, model);
      const canRetryWithFallback = index === 0 && models.length > 1 && [400, 404, 422].includes(response.status);
      if (!canRetryWithFallback) break;
    }

    if (!response || !response.ok) {
      const status = response?.status || 502;
      return NextResponse.json({ success: false, error: providerError(status) }, { status: status >= 500 ? 502 : status });
    }
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const output = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "{}";
    const draft = normalizeAiDraft(JSON.parse(output), facts.hasFeatureImage);
    return NextResponse.json({ success: true, draft });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_INPUT") return NextResponse.json({ success: false, error: "Custom direction must be 1,200 characters or fewer." }, { status: 400 });
    console.error("Location Page AI request failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ success: false, error: "The assistant did not return a valid draft within the field limits. Retry or adjust the direction." }, { status: 502 });
  }
}
