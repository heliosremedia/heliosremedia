import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/site-settings";
import { normalizeEmailTemplateKey } from "@/lib/client-communications/email-format";

export const maxDuration = 90;

function outputText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const payload = result as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> };
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.output ?? []).flatMap((item) => item.content ?? []).map((item) => typeof item.text === "string" ? item.text : "").join("");
}

const draftSchema = {
  type: "object", additionalProperties: false,
  required: ["subjectOptions", "previewText", "body", "cta"],
  properties: {
    subjectOptions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
    previewText: { type: "string" }, body: { type: "string" }, cta: { type: "string" },
  },
} as const;

const formatSchema = {
  type: "object", additionalProperties: false,
  required: ["formattedBody", "changes"],
  properties: {
    formattedBody: { type: "string" },
    changes: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
} as const;

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action === "format" ? "format" : "draft";
    const existingBody = typeof body.body === "string" ? body.body.trim().slice(0, 20_000) : "";
    const templateKey = normalizeEmailTemplateKey(body.templateKey);
    const brief = typeof body.brief === "string" ? body.brief.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.slice(0, 80) : "refined and human";
    const length = typeof body.length === "string" ? body.length.slice(0, 40) : "concise";
    if (action === "draft" && (brief.length < 12 || brief.length > 5000)) return NextResponse.json({ success: false, error: "Add a clear brief between 12 and 5,000 characters." }, { status: 400 });
    if (action === "format" && existingBody.length < 12) return NextResponse.json({ success: false, error: "Add a message before asking AI to format it." }, { status: 400 });
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ success: false, error: "AI writing is not configured yet." }, { status: 503 });
    const settings = await getSiteSettings();
    const model = process.env.OPENAI_EMAIL_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini";
    const requestBody = {
        model,
        instructions: action === "format"
          ? `You format existing marketing email copy for ${settings.businessName}. Preserve every factual claim, sentence meaning, personalization token, offer, code, URL, and call to action. Do not rewrite, add, delete, summarize, or reorder ideas. Add only restrained Markdown: **bold** for a few key phrases, ### headings where the copy clearly changes sections, bullets where a list already exists, and --- only when a divider materially helps. Format for the ${templateKey} template. Return JSON with formattedBody and changes (a short array of strings).`
          : `You write draft marketing emails for ${settings.businessName}. Voice: ${settings.brandVoice || "refined, intentional, knowledgeable, and human"}. Audience: ${settings.brandAudience || "clients and business partners"}. Use only facts in the brief or established business context. Never invent statistics, offers, events, dates, testimonials, urgency, or claims. Never select recipients, schedules, or sending actions. Return JSON with subjectOptions (3 strings), previewText, body, and cta.`,
        input: action === "format" ? `Format this existing email without rewriting it:\n\n${existingBody}` : `Create a ${length}, ${tone} email draft from this verified brief:\n\n${brief}`,
        text: { format: { type: "json_schema", name: action === "format" ? "email_format" : "email_draft", strict: true, schema: action === "format" ? formatSchema : draftSchema } },
    };
    let lastFailure = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody), signal: AbortSignal.timeout(70_000),
      });
      if (!response.ok) {
        lastFailure = `provider_${response.status}`;
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (retryable && attempt === 0) continue;
        console.error("Email Studio AI provider failure", { status: response.status, action, model });
        return NextResponse.json({ success: false, error: response.status === 429 ? "The writing service is busy. Wait a moment, then try again." : response.status === 401 || response.status === 403 ? "The Email Studio AI connection needs administrator attention." : "The writing service could not complete this request. Your email was preserved." }, { status: retryable ? 502 : response.status });
      }
      const output = outputText(await response.json());
      if (!output) { lastFailure = "empty_output"; if (attempt === 0) continue; }
      else {
        const parsed = JSON.parse(output) as Record<string, unknown>;
        if (action === "format" && typeof parsed.formattedBody !== "string") throw new Error("INVALID_FORMAT_RESPONSE");
        if (action === "draft" && (!Array.isArray(parsed.subjectOptions) || typeof parsed.body !== "string")) throw new Error("INVALID_DRAFT_RESPONSE");
        return NextResponse.json(action === "format" ? { success: true, ...parsed } : { success: true, draft: parsed });
      }
    }
    console.error("Email Studio AI returned no usable output", { action, model, category: lastFailure });
    return NextResponse.json({ success: false, error: "The writing service returned an incomplete response. Please try again." }, { status: 502 });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("Email Studio AI request failed", { category: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ success: false, error: timedOut ? "The writing service took too long to respond. Please try again." : "The writing service returned an invalid response. Your email was preserved." }, { status: timedOut ? 504 : 502 });
  }
}
