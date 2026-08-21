import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { canManageGoogleBusiness } from "@/lib/google-business-admin";
import { syncGoogleBusinessReviews } from "@/lib/google-business-reviews";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (!canManageGoogleBusiness(session)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  try {
    const result = await syncGoogleBusinessReviews(session.workspaceId);
    await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_REVIEWS_SYNCED", entityType: "Testimonial", summary: `${result.imported} Google reviews imported and ${result.updated} refreshed.` });
    revalidatePath("/"); revalidatePath("/admin/testimonials");
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Google reviews could not be synchronized." }, { status: 502 });
  }
}
