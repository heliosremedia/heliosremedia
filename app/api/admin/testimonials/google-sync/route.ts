import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { isGoogleReviewsConfigured, syncGoogleBusinessReviews } from "@/lib/google-business-reviews";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    const result = await syncGoogleBusinessReviews();
    await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_REVIEWS_SYNCED", entityType: "Testimonial", summary: `${result.imported} Google reviews imported and ${result.updated} refreshed.` });
    revalidatePath("/"); revalidatePath("/admin/testimonials");
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Unable to sync Google reviews:", error);
    return NextResponse.json({ success: false, configured: isGoogleReviewsConfigured(), error: error instanceof Error ? error.message : "Google reviews could not be synchronized." }, { status: 502 });
  }
}
