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
  const result = await prisma.$transaction(async (tx) => {
    // Serialize curation of this review before reading its current linkage.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "GoogleBusinessReview"
      WHERE "id" = ${reviewId} AND "workspaceId" = ${session.workspaceId}
      FOR UPDATE
    `;
    if (!locked.length) return { status: 404, error: "The imported review was not found." } as const;
    const review = await tx.googleBusinessReview.findFirst({
      where: { id: reviewId, workspaceId: session.workspaceId },
      select: { id: true, testimonialId: true, reviewerName: true, reviewerPhotoUrl: true, starRating: true,
        reviewText: true, reviewCreatedAt: true, testimonial: { select: { id: true, workspaceId: true } } },
    });
    if (!review) return { status: 404, error: "The imported review was not found." } as const;
    if (review.testimonialId) {
      if (!review.testimonial || review.testimonial.workspaceId !== session.workspaceId) {
        return { status: 409, error: "The review's testimonial ownership must be reconciled." } as const;
      }
      return { status: 200, testimonialId: review.testimonial.id } as const;
    }
    if (!review.reviewText?.trim()) return { status: 400, error: "A text review is required before creating a curated draft." } as const;
    const order = await tx.testimonial.aggregate({ where: { workspaceId: session.workspaceId }, _max: { displayOrder: true } });
    const testimonial = await tx.testimonial.create({ data: { workspaceId: session.workspaceId, agentName: review.reviewerName, testimonial: displayTestimonial(review.reviewText.trim()), rating: review.starRating, sourceProvider: "GOOGLE", externalReviewId: null, reviewerPhotoUrl: review.reviewerPhotoUrl, reviewedAt: review.reviewCreatedAt, displayOrder: (order._max.displayOrder ?? -1) + 1, published: false, featured: false } });
    await tx.googleBusinessReview.update({ where: { id: review.id, workspaceId: session.workspaceId, AND: [{ testimonialId: null }] }, data: { testimonialId: testimonial.id } });
    return { status: 201, testimonialId: testimonial.id } as const;
  });
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  if (result.status === 201) {
    await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_REVIEW_CURATED", entityType: "Testimonial", entityId: result.testimonialId, summary: "Imported Google review added to Featured Google Reviews as an unpublished draft." });
    revalidatePath("/admin/testimonials");
  }
  return NextResponse.json({ success: true, testimonialId: result.testimonialId }, { status: result.status });
}
