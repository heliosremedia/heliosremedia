import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { canManageGoogleBusiness } from "@/lib/google-business-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  const session = await getAdminSession();
  if (!session || !canManageGoogleBusiness(session)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const body = await request.json() as { visible?: unknown };
  if (body.visible !== true && body.visible !== false && body.visible !== null) return NextResponse.json({ success: false, error: "Choose whether this review should be shown publicly." }, { status: 400 });
  const { reviewId } = await params;
  const review = await prisma.googleBusinessReview.findFirst({ where: { id: reviewId, workspaceId: session.workspaceId }, select: { id: true, reviewerName: true } });
  if (!review) return NextResponse.json({ success: false, error: "The imported review was not found." }, { status: 404 });
  await prisma.googleBusinessReview.update({ where: { id: review.id }, data: { publicVisibilityOverride: body.visible } });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_REVIEW_VISIBILITY_UPDATED", entityType: "GoogleBusinessReview", entityId: review.id, summary: `${review.reviewerName}'s review visibility was ${body.visible === null ? "returned to the automatic rule" : body.visible ? "set to public" : "hidden from public pages"}.` });
  revalidatePath("/");
  revalidatePath("/reviews");
  revalidatePath("/admin/testimonials");
  return NextResponse.json({ success: true });
}
