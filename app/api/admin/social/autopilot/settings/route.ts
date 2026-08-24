import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ensureAutopilotSettings, publicAutopilotSettings } from "@/lib/social/autopilot";
import { requireWorkspaceId } from "@/lib/workspaces";

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => Number.isInteger(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const workspaceId = await requireWorkspaceId(session.userId);
  const current = await ensureAutopilotSettings(workspaceId);
  const body = await request.json() as Record<string, unknown>;
  const data = {
    postsPerWeek: boundedInt(body.postsPerWeek, current.postsPerWeek, 1, 7),
    hashtagLimit: boundedInt(body.hashtagLimit, current.hashtagLimit, 0, 30),
    geographicMarket: typeof body.geographicMarket === "string" ? body.geographicMarket.trim().slice(0, 300) || null : current.geographicMarket,
    notificationRecipients: Array.isArray(body.notificationRecipients) ? body.notificationRecipients.filter((item): item is string => typeof item === "string" && item.includes("@")).slice(0, 10) : current.notificationRecipients,
    ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
    ...(typeof body.aiImagesEnabled === "boolean" ? { aiImagesEnabled: body.aiImagesEnabled } : {}),
    ...(typeof body.externalResearchEnabled === "boolean" ? { externalResearchEnabled: body.externalResearchEnabled } : {}),
  };
  const settings = await prisma.socialAutopilotSettings.update({
    where: { workspaceId },
    data,
  });
  return NextResponse.json({ success: true, settings: publicAutopilotSettings(settings) });
}
