import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { canManageGoogleBusiness } from "@/lib/google-business-admin";
import { normalizeGoogleReviewDisplayMode } from "@/lib/google-business-public";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !canManageGoogleBusiness(session)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const body = await request.json() as { mode?: unknown };
  if (body.mode !== "FOUR_AND_FIVE" && body.mode !== "FIVE_ONLY" && body.mode !== "MANUAL_ONLY") return NextResponse.json({ success: false, error: "Select a valid public review setting." }, { status: 400 });
  const mode = normalizeGoogleReviewDisplayMode(body.mode);
  await prisma.siteSettings.upsert({ where: { id: "default" }, create: { id: "default", workspaceId: session.workspaceId, googleReviewDisplayMode: mode }, update: { workspaceId: session.workspaceId, googleReviewDisplayMode: mode } });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_REVIEW_DISPLAY_UPDATED", entityType: "SiteSettings", summary: `Public Google review display mode changed to ${mode}.` });
  revalidatePath("/");
  revalidatePath("/reviews");
  revalidatePath("/admin/testimonials");
  return NextResponse.json({ success: true });
}
