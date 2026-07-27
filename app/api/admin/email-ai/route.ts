import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/site-settings";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const brief = typeof body.brief === "string" ? body.brief.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.slice(0, 80) : "refined and human";
    const length = typeof body.length === "string" ? body.length.slice(0, 40) : "concise";
    if (brief.length < 12 || brief.length > 5000) return NextResponse.json({ success: false, error: "Add a clear brief between 12 and 5,000 characters." }, { status: 400 });
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ success: false, error: "AI writing is not configured yet." }, { status: 503 });
    const settings = await getSiteSettings();
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_EMAIL_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini",
        instructions: `You write draft marketing emails for ${settings.businessName}. Voice: ${settings.brandVoice || "refined, intentional, knowledgeable, and human"}. Audience: ${settings.brandAudience || "clients and business partners"}. Use only facts in the brief or established business context. Never invent statistics, offers, events, dates, testimonials, urgency, or claims. Never select recipients, schedules, or sending actions. Return JSON with subjectOptions (3 strings), previewText, body, and cta.`,
        input: `Create a ${length}, ${tone} email draft from this verified brief:\n\n${brief}`,
        text: { format: { type: "json_object" } },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return NextResponse.json({ success: false, error: response.status===429?"AI is temporarily rate limited. Try again shortly.":"AI could not complete the draft. Your existing email was preserved." }, { status: response.status>=500?502:response.status });
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const output = result.output_text || result.output?.flatMap(item=>item.content||[]).map(item=>item.text||"").join("") || "{}";
    return NextResponse.json({ success: true, draft: JSON.parse(output) });
  } catch (error) {
    console.error("Email Studio AI request failed:", error);
    return NextResponse.json({ success: false, error: "AI could not complete the draft. Your existing email was preserved." }, { status: 500 });
  }
}
