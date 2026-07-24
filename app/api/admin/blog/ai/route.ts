import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";

function text(value: unknown, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > max) throw new Error("INVALID_INPUT");
  return result;
}

type OpenAiError = {
  error?: {
    code?: string | null;
    message?: string;
    type?: string;
  };
};

function openAiErrorMessage(status: number, payload: OpenAiError) {
  const code = payload.error?.code || payload.error?.type || "";
  const message = payload.error?.message || "";

  if (status === 401) {
    return "AI draft could not be generated because the OpenAI API key was rejected. Replace OPENAI_API_KEY in Vercel, then try again.";
  }
  if (status === 403) {
    return "AI draft could not be generated because the OpenAI project does not allow this request. Check the API key permissions in OpenAI.";
  }
  if (status === 429 && (code === "insufficient_quota" || /quota|billing|credit/i.test(message))) {
    return "AI draft could not be generated because the OpenAI API account has no available credits. Add billing or increase the project budget, then try again.";
  }
  if (status === 429) {
    return "AI draft could not be generated because OpenAI is rate limiting requests. Wait a moment, then try again.";
  }
  if (code === "model_not_found" || /model.*(access|exist|found)/i.test(message)) {
    return "AI draft could not be generated because the configured OpenAI model is unavailable to this project. Check OPENAI_BLOG_MODEL in Vercel.";
  }
  if (status >= 500) {
    return "AI draft could not be generated because OpenAI is temporarily unavailable. Try again in a few minutes.";
  }
  return "AI draft could not be generated because OpenAI rejected the request. Check the OpenAI project settings and try again.";
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ success: false, error: "AI writing is not configured yet." }, { status: 503 });
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "draft";
    const input = text(body.input, action === "draft" ? 5000 : 100_000);
    const settings = await getSiteSettings();
    const instruction = `You are the editorial assistant for ${settings.businessName}. Write polished, accurate real-estate media marketing content. Brand voice: ${settings.brandVoice || "refined, intentional, cinematic, knowledgeable, and human"}. Audience: ${settings.brandAudience || "real estate agents, builders, designers, and property professionals"}. Guidance: ${settings.brandWritingGuidance || "Avoid hype, clichés, fabricated statistics, legal claims, and keyword stuffing."} Always preserve factual uncertainty and never invent sources.`;
    const actionPrompt: Record<string, string> = {
      draft: "Create a complete blog draft. Return JSON with title, excerpt, content, category, seoTitle, seoDescription, socialCaption, and suggestedInternalLinks. Content must be plain text with Markdown headings.",
      improve: "Improve clarity, structure, brand voice, and SEO without changing the facts. Return JSON with content, excerpt, seoTitle, seoDescription, and socialCaption.",
      shorten: "Shorten this article by about 30 percent while preserving its strongest ideas. Return JSON with content and excerpt.",
      expand: "Expand this article with useful context and practical detail without inventing facts. Return JSON with content, excerpt, seoTitle, and seoDescription.",
      headlines: "Create eight refined headline options. Return JSON with a headlines array.",
      social: "Create platform-ready social captions for Facebook, LinkedIn, Instagram, and X. Return JSON with facebook, linkedin, instagram, and x.",
    };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini",
        instructions: instruction,
        input: `${actionPrompt[action] || actionPrompt.draft}\n\n${input}`,
        text: { format: { type: "json_object" } },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const details = await response.text();
      let payload: OpenAiError = {};
      try {
        payload = JSON.parse(details) as OpenAiError;
      } catch {
        // OpenAI normally returns JSON errors. Keep the response safe and actionable
        // if an upstream proxy returns plain text instead.
      }
      console.error("OpenAI rejected Blog Studio request", {
        status: response.status,
        code: payload.error?.code || payload.error?.type || "unknown",
        details: details.slice(0, 1000),
      });
      return NextResponse.json(
        { success: false, error: openAiErrorMessage(response.status, payload) },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const output = result.output_text || result.output?.flatMap(item => item.content || []).map(item => item.text || "").join("") || "{}";
    return NextResponse.json({ success: true, result: JSON.parse(output) });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "INVALID_INPUT") return NextResponse.json({ success: false, error: "Add a brief or article before using AI." }, { status: 400 });
    console.error("Blog Studio AI request failed:", cause);
    return NextResponse.json({ success: false, error: "The AI request could not be completed." }, { status: 500 });
  }
}
