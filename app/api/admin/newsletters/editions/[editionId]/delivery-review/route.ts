import { NextResponse } from "next/server";
import { requireNewsletterAdministrator, forbiddenNewsletterResponse } from "@/lib/newsletters/api";
import { getNewsletterDeliveryReview } from "@/lib/newsletters/delivery-review";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, context: { params: Promise<{ editionId: string }> }) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  try {
    const { editionId } = await context.params;
    const review = await getNewsletterDeliveryReview(editionId, session);
    if (!review) return NextResponse.json({ success: false, error: "Edition not found." }, { status: 404, headers });
    return NextResponse.json({ success: true, review }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return forbiddenNewsletterResponse();
    return NextResponse.json({ success: false, error: "Delivery evidence needs further review before reconciliation." }, { status: 409, headers });
  }
}
