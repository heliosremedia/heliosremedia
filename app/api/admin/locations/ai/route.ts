import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { LOCATION_FIELD_LIMITS, normalizeAiDraft } from "@/lib/location-page-content";
import { prisma } from "@/lib/prisma";

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
    const instructions = `You are the location-page writing assistant for ${settings.businessName}. Return only a JSON object with heroLead, introduction, marketTitle, marketCopy, ctaHeadline, seoTitle, seoDescription, and featureImageAlt when an image exists. Write premium, calm, locally specific, human copy in the company's voice. Use only the supplied facts. Do not invent neighborhoods, landmarks, statistics, rankings, awards, reviews, offices, market claims, or service claims. Do not use em dashes, keyword stuffing, hype, or interchangeable city-name-swapped structure. Use natural paragraphs with blank lines where helpful. Observe these hard character limits: heroLead 320, introduction 1400, marketTitle 240, marketCopy 1400, ctaHeadline 240, seoTitle 160, seoDescription 320, featureImageAlt 240. The content is a reviewable draft, never a publication instruction.`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_LOCATION_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini",
        instructions,
        input: JSON.stringify(facts),
        text: { format: { type: "json_object" } },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      console.error("Location Page AI provider rejection", { status: response.status });
      return NextResponse.json({ success: false, error: providerError(response.status) }, { status: response.status >= 500 ? 502 : response.status });
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
