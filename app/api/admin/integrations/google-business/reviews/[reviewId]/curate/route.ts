import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { canManageGoogleBusiness } from "@/lib/google-business-admin";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { displayTestimonial } from "@/lib/testimonials";

export async function POST(_request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  const session = await getAdminSession();
  if (!session || !canManageGoogleBusiness(session)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const { reviewId } = await params;
  const review = await prisma.googleBusinessReview.findFirst({ where: { id: reviewId, workspaceId: session.workspaceId }, select: { id: true, testimonialId: true, reviewerName: true, reviewerPhotoUrl: true, starRating: true, reviewText: true, reviewCreatedAt: true } });
  if (!review) return NextResponse.json({ success: false, error: "The imported review was not found." }, { status: 404 });
  if (review.testimonialId) return NextResponse.json({ success: true, testimonialId: review.testimonialId });
  if (!review.reviewText?.trim()) return NextResponse.json({ success: false, error: "A text review is required before creating a curated draft." }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.testimonial.aggregate({ _max: { displayOrder: true } });
    const testimonial = await tx.testimonial.create({ data: { agentName: review.reviewerName, testimonial: displayTestimonial(review.reviewText!.trim()), rating: review.starRating, sourceProvider: "GOOGLE", externalReviewId: null, reviewerPhotoUrl: review.reviewerPhotoUrl, reviewedAt: review.reviewCreatedAt, displayOrder: (order._max.displayOrder ?? -1) + 1, published: false, featured: false } });
    await tx.googleBusinessReview.update({ where: { id: review.id }, data: { testimonialId: testimonial.id } });
    return testimonial;
  });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_REVIEW_CURATED", entityType: "Testimonial", entityId: result.id, summary: "Imported Google review added to Featured Google Reviews as an unpublished draft." });
  revalidatePath("/admin/testimonials");
  return NextResponse.json({ success: true, testimonialId: result.id }, { status: 201 });
}
