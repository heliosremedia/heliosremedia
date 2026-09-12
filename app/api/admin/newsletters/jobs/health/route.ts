import { NextResponse } from "next/server";
import { requireNewsletterAdministrator } from "@/lib/newsletters/api";
import { getNewsletterJobHealth } from "@/lib/newsletters/job-health";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const actor = await requireNewsletterAdministrator();
    if (!actor) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403, headers });
    return NextResponse.json({ success: true, health: await getNewsletterJobHealth(actor) }, { headers });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN";
    return NextResponse.json({ success: false, error: forbidden ? "Administrator access is required." : "Job status is unavailable. Refresh to try again." }, { status: forbidden ? 403 : 503, headers });
  }
}
