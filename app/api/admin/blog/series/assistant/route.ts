import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { BLOG_SERIES_PROPOSAL_SCHEMA, parseAssistantBrief, parseBlogSeriesProposal } from "@/lib/blog-series-assistant";

export const maxDuration = 90;
const WINDOW_MS = 10 * 60 * 1000;
const REQUEST_LIMIT = 5;

function safeCurrentForm(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, string | number | string[]> = {};
  for (const key of ["name","purpose","targetAudience","brandVoice","prioritizeTopics","avoidTopics","seoFocus","preferredCta","imagePreferences","cadence"] as const) {
    if (typeof source[key] === "string") result[key] = source[key].slice(0, 3000);
  }
  if (Array.isArray(source.contentPillars)) result.contentPillars = source.contentPillars.filter((item): item is string => typeof item === "string").slice(0, 20).map(item => item.slice(0, 100));
  if (typeof source.leadDays === "number") result.leadDays = Math.max(1, Math.min(30, source.leadDays));
  if (typeof source.targetLength === "number") result.targetLength = Math.max(500, Math.min(2500, source.targetLength));
  return result;
}

async function authorizedContext(workspaceId: string) {
  const [workspaceCount, settings] = await Promise.all([
    prisma.workspace.count(),
    prisma.siteSettings.findFirst({ where: { workspaceId }, select: { businessName:true, brandVoice:true, brandAudience:true, brandWritingGuidance:true } }),
  ]);
  // BlogSeries and BlogPost predate workspaces. Never expose those global records
  // if this installation is expanded beyond its canonical single workspace.
  if (workspaceCount !== 1 || !settings) throw new Error("WORKSPACE_CONTEXT_UNAVAILABLE");
  const [services, locations, projects, series, posts, callsToAction] = await Promise.all([
    prisma.service.findMany({ where:{ workspaceId, active:true, archivedAt:null }, orderBy:{ displayOrder:"asc" }, take:30, select:{ name:true, description:true } }),
    prisma.locationPage.findMany({ where:{ workspaceId, published:true }, orderBy:{ displayOrder:"asc" }, take:30, select:{ city:true, state:true, serviceArea:true, slug:true } }),
    prisma.project.findMany({ where:{ workspaceId, status:"PUBLISHED", archivedAt:null }, orderBy:{ publishedAt:"desc" }, take:40, select:{ title:true, shortDescription:true, projectType:true, services:{ select:{ service:{ select:{ name:true } } } } } }),
    prisma.blogSeries.findMany({ orderBy:{ updatedAt:"desc" }, take:30, select:{ name:true, purpose:true, contentPillars:true, seoFocus:true } }),
    prisma.blogPost.findMany({ where:{ status:{ in:["PUBLISHED","SCHEDULED","DRAFT"] } }, orderBy:{ updatedAt:"desc" }, take:100, select:{ title:true, slug:true, excerpt:true, category:true, seoTitle:true, seoDescription:true, status:true } }),
    prisma.callToAction.findMany({ where:{ published:true }, take:20, select:{ internalName:true, headline:true, primaryLabel:true, primaryValue:true } }),
  ]);
  return { settings, services, locations, projects, series, posts, callsToAction };
}

function extractOutput(result: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  return result.output_text || result.output?.flatMap(item => item.content || []).map(item => item.text || "").join("") || "";
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success:false, error:"Authentication is required." }, { status:401 });
  if (session.role === "VIEWER") return NextResponse.json({ success:false, error:"You do not have permission to build blog series." }, { status:403 });
  try {
    const recent = await prisma.auditEvent.count({ where:{ actorId:session.userId, action:"BLOG_SERIES_AI_PROPOSAL_REQUESTED", createdAt:{ gte:new Date(Date.now()-WINDOW_MS) } } });
    if (recent >= REQUEST_LIMIT) return NextResponse.json({ success:false, error:"The assistant has reached its short-term limit. Try again in a few minutes." }, { status:429, headers:{ "Retry-After":"600" } });
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ success:false, error:"The Blog Series AI Assistant is not configured yet." }, { status:503 });
    const body = await request.json() as Record<string, unknown>;
    const brief = parseAssistantBrief(body.brief);
    const currentForm = safeCurrentForm(body.currentForm);
    const currentProposal = body.currentProposal ? parseBlogSeriesProposal(body.currentProposal) : null;
    const regenerateField = typeof body.regenerateField === "string" ? body.regenerateField.slice(0, 80) : "";
    const context = await authorizedContext(session.workspaceId);
    await recordAuditEvent({ actorId:session.userId, actorEmail:session.email, action:"BLOG_SERIES_AI_PROPOSAL_REQUESTED", entityType:"BlogSeries", summary:"Requested a temporary Blog Series proposal.", metadata:{ workspaceId:session.workspaceId, regeneration:Boolean(regenerateField) } });
    const instructions = `You are the Blog Series AI Assistant for ${context.settings.businessName}. Return only the requested JSON schema. Build a strategically coherent 6 to 12 article plan using only the supplied authorized context. Voice must be refined, intentional, cinematic, knowledgeable, useful, and human. Never invent statistics, awards, results, testimonials, clients, listings, prices, locations, or services. Avoid unsupported performance claims, generic AI filler, keyword stuffing, and duplication. Northern Colorado references must be genuinely relevant. Compare every proposal with existing series and articles. Put each likely overlap in conflicts with the exact conflicting content, reason, differentiation, and revised topic. Put every claim needing human verification in factualConfirmations. Suggestions are planning data only. Never imply anything was saved, scheduled, generated as an article, or published.`;
    const input = JSON.stringify({ task: regenerateField ? `Regenerate only ${regenerateField}; return the complete proposal with all other fields unchanged.` : "Create a complete Blog Series proposal.", brief, currentForm, currentProposal, authorizedContext:context });
    const response = await fetch("https://api.openai.com/v1/responses", { method:"POST", headers:{ Authorization:`Bearer ${apiKey}`, "Content-Type":"application/json" }, body:JSON.stringify({ model:process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini", instructions, input, text:{ format:{ type:"json_schema", name:"blog_series_proposal", strict:true, schema:BLOG_SERIES_PROPOSAL_SCHEMA } } }), signal:AbortSignal.timeout(75_000) });
    if (!response.ok) {
      console.error("Blog Series assistant provider failure", { status:response.status });
      return NextResponse.json({ success:false, error:response.status===429?"The writing service is busy. Wait a moment, then try again.":"The assistant could not complete the proposal. Your form has not changed." }, { status:response.status===429?429:502 });
    }
    const proposal = parseBlogSeriesProposal(JSON.parse(extractOutput(await response.json()) || "{}"));
    await recordAuditEvent({ actorId:session.userId, actorEmail:session.email, action:"BLOG_SERIES_AI_PROPOSAL_GENERATED", entityType:"BlogSeries", summary:"Generated a temporary Blog Series proposal for administrator review.", metadata:{ workspaceId:session.workspaceId, model:process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini", roadmapCount:proposal.roadmap.length, regeneration:Boolean(regenerateField) } });
    return NextResponse.json({ success:true, proposal });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BRIEF") return NextResponse.json({ success:false, error:"Complete the required brief fields before generating a proposal." }, { status:400 });
    if (error instanceof Error && error.message === "WORKSPACE_CONTEXT_UNAVAILABLE") return NextResponse.json({ success:false, error:"The assistant could not verify this workspace. No content was shared." }, { status:409 });
    console.error("Blog Series assistant request failed", { category:error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ success:false, error:"The assistant could not complete the proposal. Your form has not changed." }, { status:500 });
  }
}
