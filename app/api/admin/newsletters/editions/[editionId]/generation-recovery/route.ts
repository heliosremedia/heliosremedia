import { NextResponse } from "next/server";
import { requireNewsletterAdministrator, forbiddenNewsletterResponse } from "@/lib/newsletters/api";
import { getNewsletterGenerationRecovery, recoverNewsletterGeneration } from "@/lib/newsletters/generation-recovery";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return forbiddenNewsletterResponse();
  return NextResponse.json({ success: false, error: "Generation evidence changed or cannot be recovered. Refresh the review." }, { status: 409, headers });
}
export async function GET(_request: Request, context: { params: Promise<{ editionId: string }> }) {
  const actor = await requireNewsletterAdministrator();
  if (!actor) return forbiddenNewsletterResponse();
  try { return NextResponse.json({ success: true, review: await getNewsletterGenerationRecovery((await context.params).editionId, actor) }, { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request, context: { params: Promise<{ editionId: string }> }) {
  const actor = await requireNewsletterAdministrator();
  if (!actor) return forbiddenNewsletterResponse();
  try {
    const body = await request.json();
    if (body?.confirmation !== "RETURN_EXPIRED_GENERATION_TO_REVIEW" || !Number.isSafeInteger(body.expectedVersion) || typeof body.runId !== "string" || !body.runId) {
      return NextResponse.json({ success: false, error: "Confirm the reviewed generation run and edition version." }, { status: 400, headers });
    }
    return NextResponse.json({ success: true, ...await recoverNewsletterGeneration((await context.params).editionId, body.expectedVersion, body.runId, actor) }, { headers });
  } catch (error) { return failure(error); }
}
