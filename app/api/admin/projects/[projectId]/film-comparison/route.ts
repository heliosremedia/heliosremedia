import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ projectId: string }> };
const clean = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

export async function GET(_request: Request, { params }: Props) {
  const session = await requireAdminSession();
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { id: true } });
  if (!project) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
  const [offerings, media] = await Promise.all([
    prisma.videoOffering.findMany({ where: { workspaceId: session.workspaceId, active: true }, orderBy: [{ offeringGroup: "asc" }, { comparisonOrder: "asc" }], select: { id: true, publicName: true, offeringGroup: true } }),
    prisma.media.findMany({ where: { projectId, sourceType: { in: ["VIDEO_EMBED", "UPLOADED_VIDEO"] } }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true, originalFilename: true, externalUrl: true, visibility: true, provider: true, comparisonPlacement: { select: { offeringId: true, showOnComparison: true, featuredExample: true, comparisonOrder: true, publicTitle: true, posterOverrideUrl: true } } } }),
  ]);
  return NextResponse.json({ success: true, offerings, media });
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const session = await requireAdminSession();
    const { projectId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const mediaId = clean(body.mediaId, 120);
    const offeringId = clean(body.offeringId, 120);
    if (!mediaId) return NextResponse.json({ success: false, error: "Select a video." }, { status: 400 });
    const media = await prisma.media.findFirst({ where: { id: mediaId, projectId, project: { workspaceId: session.workspaceId }, sourceType: { in: ["VIDEO_EMBED", "UPLOADED_VIDEO"] } }, select: { id: true } });
    if (!media) return NextResponse.json({ success: false, error: "Video not found." }, { status: 404 });
    if (!offeringId) {
      await prisma.videoComparisonPlacement.deleteMany({ where: { mediaId, workspaceId: session.workspaceId } });
      revalidatePath("/films");
      return NextResponse.json({ success: true, placement: null });
    }
    const offering = await prisma.videoOffering.findFirst({ where: { id: offeringId, workspaceId: session.workspaceId, active: true }, select: { id: true } });
    if (!offering) return NextResponse.json({ success: false, error: "Select an active offering." }, { status: 409 });
    const featuredExample = body.featuredExample === true;
    const placement = await prisma.$transaction(async (tx) => {
      if (featuredExample) await tx.videoComparisonPlacement.updateMany({ where: { workspaceId: session.workspaceId, offeringId, featuredExample: true, mediaId: { not: mediaId } }, data: { featuredExample: false } });
      return tx.videoComparisonPlacement.upsert({
        where: { mediaId },
        create: { workspaceId: session.workspaceId, mediaId, offeringId, showOnComparison: body.showOnComparison === true, featuredExample, comparisonOrder: Number.isInteger(body.comparisonOrder) ? Number(body.comparisonOrder) : 0, publicTitle: clean(body.publicTitle, 160), posterOverrideUrl: clean(body.posterOverrideUrl, 1000) },
        update: { offeringId, showOnComparison: body.showOnComparison === true, featuredExample, comparisonOrder: Number.isInteger(body.comparisonOrder) ? Number(body.comparisonOrder) : 0, publicTitle: clean(body.publicTitle, 160), posterOverrideUrl: clean(body.posterOverrideUrl, 1000) },
      });
    });
    revalidatePath("/films");
    return NextResponse.json({ success: true, placement });
  } catch (error) {
    console.error("Unable to update film comparison classification:", error);
    return NextResponse.json({ success: false, error: "The film comparison classification could not be saved." }, { status: 500 });
  }
}
