import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { studioEnabledFor } from "@/lib/studio-access";
import { getNewsletterJobHealth } from "@/lib/newsletters/job-health";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Studio's qualified owned read projection; no newsletter mutation admission. */
export async function GET() {
  try {
    const actor = await getAdminSession();
    if (!actor || !studioEnabledFor(actor)) return NextResponse.json({ success: false, error: "Studio access is unavailable." }, { status: 403, headers });
    const health = await getNewsletterJobHealth(actor);
    // The broader newsletter module retains its independent single-company gate.
    const workspaces = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    const editionReviewAvailable = workspaces.length === 1 && workspaces[0].id === actor.workspaceId;
    return NextResponse.json({ success: true, health: { ...health, editionReviewAvailable } }, { headers });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN";
    return NextResponse.json({ success: false, error: "Job status is unavailable. Refresh your session and try again." }, { status: forbidden ? 403 : 503, headers });
  }
}
