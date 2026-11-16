import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PROJECT_WRITING_SOURCE_LIMIT, parseProjectWritingDraft, projectWritingInstructions, projectWritingSchema } from "@/lib/project-writing";

export const maxDuration = 90;
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Sign in to use the writing helper." }, { status: 401 });
  if (session.role === "VIEWER") return NextResponse.json({ success: false, error: "Editing permission is required." }, { status: 403 });
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ success: false, error: "Use the writing helper from this workspace." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 20_000) return NextResponse.json({ success: false, error: "The description is too long." }, { status: 413 });
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid request");
    body = parsed;
  } catch { return NextResponse.json({ success: false, error: "Enter a valid property description." }, { status: 400 }); }
  const source = typeof body.source === "string" ? body.source.trim() : "";
  if (source.length < 20 || source.length > PROJECT_WRITING_SOURCE_LIMIT) return NextResponse.json({ success: false, error: "Paste a description between 20 and 12,000 characters." }, { status: 400 });
  if (body.projectId !== undefined) {
    if (typeof body.projectId !== "string" || body.projectId.length > 200 || !body.projectId.trim()) return NextResponse.json({ success: false, error: "Invalid project." }, { status: 400 });
    const project = await prisma.project.findFirst({ where: { id: body.projectId, workspaceId: session.workspaceId }, select: { id: true } });
    if (!project) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ success: false, error: "AI writing is not configured yet." }, { status: 503 });
  const model = process.env.OPENAI_PROJECT_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-6-luna";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, store: false, max_output_tokens: 4000, instructions: projectWritingInstructions, input: JSON.stringify({ agentDescription: source }), text: { format: { type: "json_schema", name: "project_writing_suggestions", strict: true, schema: projectWritingSchema } } }),
      signal: AbortSignal.timeout(75_000),
    });
    if (!response.ok) return NextResponse.json({ success: false, error: response.status === 429 ? "The writing service is busy. Try again shortly." : "The writing service could not complete the request. Your existing copy is unchanged." }, { status: 502 });
    const result = await response.json() as { status?: string; output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    if (result.status === "incomplete") throw new Error("Incomplete response");
    const output = result.output_text || (result.output ?? []).flatMap(item => item.content ?? []).map(item => typeof item.text === "string" ? item.text : "").join("");
    const draft = parseProjectWritingDraft(JSON.parse(output));
    return NextResponse.json({ success: true, draft }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    return NextResponse.json({ success: false, error: timeout ? "The writing service took too long. Your existing copy is unchanged." : "The writing service returned incomplete suggestions. Your existing copy is unchanged." }, { status: timeout ? 504 : 502 });
  }
}
