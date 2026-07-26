import "server-only";

import { prisma } from "@/lib/prisma";
import { slugifyBlogTitle } from "@/lib/blog";
import { nextBlogSeriesDates } from "@/lib/blog-series-schedule";

function outputText(result: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  return result.output_text || result.output?.flatMap(item => item.content || []).map(item => item.text || "").join("") || "{}";
}

export async function generateSeriesDraft(seriesId: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("AI writing is not configured.");
  const series = await prisma.blogSeries.findUniqueOrThrow({ where: { id: seriesId } });
  if (series.status !== "ACTIVE") throw new Error("Only active blog series can generate drafts.");
  const pillars = Array.isArray(series.contentPillars)
    ? series.contentPillars.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  const pillarIndex = pillars.length ? (series.lastPillarIndex + 1) % pillars.length : 0;
  const pillar = pillars[pillarIndex] || "Listing Marketing";
  const existing = await prisma.blogPost.findMany({
    where: { status: { in: ["NEEDS_REVIEW", "SCHEDULED", "PUBLISHED"] } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { title: true, excerpt: true, category: true, slug: true },
  });
  const settings = await prisma.siteSettings.findFirst({
    select: { businessName: true, brandVoice: true, brandAudience: true, brandWritingGuidance: true, defaultBlogAuthor: true },
  });
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "helios-studio/1.0",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini",
      instructions: `You are the editorial partner for ${settings?.businessName || "Helios Real Estate Media"}. Draft useful, specific content for ${series.targetAudience}. Voice: ${series.brandVoice || settings?.brandVoice || "refined, intentional, knowledgeable, and human"}. ${settings?.brandWritingGuidance || ""} Never invent statistics, trends, laws, client results, testimonials, or property details. Any current or externally verifiable claim must be omitted unless it is supported by a URL in sourceLinks. Avoid generic openings, generic conclusions, keyword stuffing, and repeated phrasing.`,
      input: `Create one original article draft for this recurring series.
Series purpose: ${series.purpose}
Content pillar for this edition: ${pillar}
Prioritize: ${series.prioritizeTopics || "useful real-estate media expertise"}
Avoid: ${series.avoidTopics || "unsupported claims and generic AI filler"}
Target length: approximately ${series.targetLength} words
SEO focus: ${series.seoFocus || "natural search relevance"}
Preferred CTA: ${series.preferredCta || "invite the reader to explore Helios services"}
Image direction: ${series.imagePreferences || "recommend a relevant Helios portfolio image"}
Existing and scheduled articles to avoid repeating:
${existing.map(item => `- ${item.title} | ${item.category || ""} | ${item.excerpt || ""} | /blog/${item.slug}`).join("\n")}

Return JSON with: title, excerpt, content (Markdown), category, seoTitle, seoDescription, slug, suggestedInternalLinks (array of {label,href}), suggestedImageQuery, sourceLinks (array of URLs), editorialChecks (array of short review notes).`,
      text: { format: { type: "json_object" } },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`OpenAI rejected the blog-series request (${response.status}).`);
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const draft = JSON.parse(outputText(payload)) as Record<string, unknown>;
  const title = String(draft.title || "").trim();
  const content = String(draft.content || "").trim();
  if (!title || !content) throw new Error("AI returned an incomplete blog draft.");
  const sourceLinks = Array.isArray(draft.sourceLinks)
    ? draft.sourceLinks.filter((item): item is string => typeof item === "string" && /^https?:\/\//.test(item)).slice(0, 20)
    : [];
  const notes = {
    pillar,
    suggestedImageQuery: typeof draft.suggestedImageQuery === "string" ? draft.suggestedImageQuery : null,
    suggestedInternalLinks: Array.isArray(draft.suggestedInternalLinks) ? draft.suggestedInternalLinks : [],
    editorialChecks: Array.isArray(draft.editorialChecks) ? draft.editorialChecks : [],
  };
  const post = await prisma.$transaction(async transaction => {
    const created = await transaction.blogPost.create({
      data: {
        title,
        slug: slugifyBlogTitle(String(draft.slug || title)),
        excerpt: String(draft.excerpt || "").trim() || null,
        content,
        author: settings?.defaultBlogAuthor || settings?.businessName || "Helios Real Estate Media",
        category: String(draft.category || pillar).trim(),
        status: "NEEDS_REVIEW",
        seoTitle: String(draft.seoTitle || "").trim() || null,
        seoDescription: String(draft.seoDescription || "").trim() || null,
        sourceLinks,
        seriesId: series.id,
        intendedPublishAt: series.nextPublishAt,
        aiGenerated: true,
        generationNotes: notes,
      },
    });
    await transaction.blogPostRevision.create({
      data: {
        postId: created.id, title: created.title, excerpt: created.excerpt, content: created.content,
        seoTitle: created.seoTitle, seoDescription: created.seoDescription, sourceLinks,
        changeSummary: "AI series draft generated", aiGenerated: true,
      },
    });
    const dates = nextBlogSeriesDates(series.cadence, series.nextPublishAt || new Date(), series.leadDays);
    await transaction.blogSeries.update({
      where: { id: series.id },
      data: { ...dates, lastPillarIndex: pillarIndex },
    });
    return created;
  });
  return { post, notes };
}
