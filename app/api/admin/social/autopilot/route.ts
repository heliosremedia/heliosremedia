import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { generateAutopilotWeek, publicAutopilotSettings, ensureAutopilotSettings } from "@/lib/social/autopilot";
import { requireWorkspaceId } from "@/lib/workspaces";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const workspaceId = await requireWorkspaceId(session.userId);
  const [settings, weeks] = await Promise.all([
    ensureAutopilotSettings(workspaceId),
    prisma.socialAutopilotWeek.findMany({
      where: { workspaceId }, orderBy: { weekStart: "desc" }, take: 12,
      include: { drafts: { include: { campaign: { include: { variants: { select: { id: true, platform: true, status: true, scheduledAt: true } } } } } } },
    }),
  ]);
  return NextResponse.json({ success: true, settings: publicAutopilotSettings(settings), weeks });
}

export async function POST() {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const workspaceId = await requireWorkspaceId(session.userId);
    const result = await generateAutopilotWeek({ workspaceId, actorId: session.userId, trigger: "MANUAL" });
    return NextResponse.json({ success: true, weekId: result.week.id, duplicate: result.duplicate });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Weekly plan could not be generated." }, { status: 400 });
  }
}
