import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { queueApprovedAutopilotDraft } from "@/lib/social/autopilot";
import { requireWorkspaceId } from "@/lib/workspaces";

export async function POST(_: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const workspaceId = await requireWorkspaceId(session.userId);
    const { draftId } = await params;
    const jobs = await queueApprovedAutopilotDraft({ workspaceId, draftId });
    return NextResponse.json({ success: true, jobIds: jobs.map((job) => job.id) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Draft could not be queued." }, { status: 400 });
  }
}
