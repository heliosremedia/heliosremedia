import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { normalizeDashboardPreferences } from "@/lib/dashboard-layout";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    const preferences = normalizeDashboardPreferences(await request.json());
    const updated = await prisma.adminUser.updateMany({
      where: { id: session.userId, workspaceId: session.workspaceId },
      data: { dashboardPreferences: preferences },
    });
    if (updated.count !== 1) throw new Error("ACCOUNT_NOT_FOUND");
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error("Unable to save dashboard layout:", error);
    return NextResponse.json({ success: false, error: "Dashboard layout could not be saved." }, { status: 500 });
  }
}
