import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const groups = new Set(["CINEMATIC_FILM", "SOCIAL_MEDIA_REEL"]);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id, 120);
    const publicName = text(body.publicName, 120);
    const positioningStatement = text(body.positioningStatement, 180);
    const publicDescription = text(body.publicDescription, 1200);
    const offeringGroup = text(body.offeringGroup, 40);
    if (!id || !publicName || !positioningStatement || !publicDescription || !offeringGroup || !groups.has(offeringGroup)) {
      return NextResponse.json({ success: false, error: "Complete the required offering fields." }, { status: 400 });
    }
    const existing = await prisma.videoOffering.findFirst({ where: { id, workspaceId: session.workspaceId }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: "Offering not found." }, { status: 404 });
    const distinctions = Array.isArray(body.featureDistinctions)
      ? body.featureDistinctions.map((item) => text(item, 180)).filter(Boolean).slice(0, 16)
      : [];
    const offering = await prisma.videoOffering.update({
      where: { id },
      data: {
        publicName,
        positioningStatement,
        publicDescription,
        offeringGroup: offeringGroup as "CINEMATIC_FILM" | "SOCIAL_MEDIA_REEL",
        comparisonOrder: Number.isInteger(body.comparisonOrder) ? Number(body.comparisonOrder) : 0,
        active: body.active !== false,
        priceLabel: text(body.priceLabel, 80),
        runtimeGuidance: text(body.runtimeGuidance, 120),
        orientation: text(body.orientation, 80),
        bestForDescription: text(body.bestForDescription, 320),
        featureDistinctions: distinctions,
        bookingDestination: text(body.bookingDestination, 500),
      },
    });
    revalidatePath("/films");
    revalidatePath("/admin/video-offerings");
    return NextResponse.json({ success: true, offering });
  } catch (error) {
    console.error("Unable to update video offering:", error);
    return NextResponse.json({ success: false, error: "The offering could not be saved." }, { status: 500 });
  }
}
