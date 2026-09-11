import { filmPosterMatchesWorkspace } from "@/lib/film-poster";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ projectId: string }> };
const clean = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

export async function GET(_request: Request, { params }: Props) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Sign in to view film comparisons." }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { id: true } });
  if (!project) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
  const [offerings, media] = await Promise.all([
    prisma.videoOffering.findMany({ where: { workspaceId: session.workspaceId, active: true }, orderBy: [{ offeringGroup: "asc" }, { comparisonOrder: "asc" }], select: { id: true, publicName: true, offeringGroup: true } }),
    prisma.media.findMany({ where: { projectId, project: { workspaceId: session.workspaceId }, sourceType: { in: ["VIDEO_EMBED", "UPLOADED_VIDEO"] } }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true, originalFilename: true, externalUrl: true, visibility: true, provider: true, comparisonPlacement: { where: { workspaceId: session.workspaceId, offering: { workspaceId: session.workspaceId } }, select: { offeringId: true, showOnComparison: true, featuredExample: true, comparisonOrder: true, publicTitle: true, posterOverrideUrl: true } } } }),
  ]);
  const visibleMedia = media.map((item) => ({ ...item, comparisonPlacement: item.comparisonPlacement ? {
    ...item.comparisonPlacement,
    posterOverrideUrl: filmPosterMatchesWorkspace(session.workspaceId, projectId, item.comparisonPlacement.posterOverrideUrl) ? item.comparisonPlacement.posterOverrideUrl : null,
  } : null }));
  return NextResponse.json({ success: true, offerings, media: visibleMedia });
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const { projectId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const mediaId = clean(body.mediaId, 120);
    const offeringId = clean(body.offeringId, 120);
    if (!mediaId) return NextResponse.json({ success: false, error: "Select a video." }, { status: 400 });
    const placement = await prisma.$transaction(async (tx) => {
      // Serialize competing featured selections and revalidate relationships after
      // waiting for the lock. All reads below use the trusted session company.
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${session.workspaceId} FOR UPDATE`;
      const media = await tx.media.findFirst({
        where: { id: mediaId, projectId, project: { workspaceId: session.workspaceId }, sourceType: { in: ["VIDEO_EMBED", "UPLOADED_VIDEO"] } },
        select: { id: true, comparisonPlacement: { select: { id: true, workspaceId: true, posterOverrideUrl: true, offering: { select: { workspaceId: true } } } } },
      });
      if (!media) throw new Error("VIDEO_NOT_FOUND");
      const existing = media.comparisonPlacement;
      if (existing && (existing.workspaceId !== session.workspaceId || existing.offering.workspaceId !== session.workspaceId)) throw new Error("PLACEMENT_OWNERSHIP_CONFLICT");
      if (!offeringId) {
        await tx.videoComparisonPlacement.deleteMany({ where: { mediaId, workspaceId: session.workspaceId, media: { project: { workspaceId: session.workspaceId } }, offering: { workspaceId: session.workspaceId } } });
        return null;
      }
      const offering = await tx.videoOffering.findFirst({ where: { id: offeringId, workspaceId: session.workspaceId, active: true }, select: { id: true } });
      if (!offering) throw new Error("INVALID_OFFERING");
      const posterOverrideUrl = clean(body.posterOverrideUrl, 1000);
      // The current editor clears overrides. Preserve existing scoped posters,
      // but require a future owned asset picker before accepting new custom URLs.
      if (posterOverrideUrl && (posterOverrideUrl !== existing?.posterOverrideUrl || !filmPosterMatchesWorkspace(session.workspaceId, projectId, posterOverrideUrl))) throw new Error("INVALID_POSTER");
      const featuredExample = body.featuredExample === true;
      if (featuredExample) await tx.videoComparisonPlacement.updateMany({
        where: { workspaceId: session.workspaceId, offeringId, featuredExample: true, mediaId: { not: mediaId }, media: { project: { workspaceId: session.workspaceId } } },
        data: { featuredExample: false },
      });
      const data = { offeringId, showOnComparison: body.showOnComparison === true, featuredExample, comparisonOrder: Number.isInteger(body.comparisonOrder) ? Number(body.comparisonOrder) : 0, publicTitle: clean(body.publicTitle, 160), posterOverrideUrl };
      if (existing) return tx.videoComparisonPlacement.update({ where: { id: existing.id, workspaceId: session.workspaceId, mediaId }, data });
      return tx.videoComparisonPlacement.create({ data: { ...data, workspaceId: session.workspaceId, mediaId } });
    });
    revalidatePath("/films");
    return NextResponse.json({ success: true, placement });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "VIDEO_NOT_FOUND") return NextResponse.json({ success: false, error: "Video not found." }, { status: 404 });
      if (error.message === "INVALID_OFFERING") return NextResponse.json({ success: false, error: "Select an active offering for this company." }, { status: 409 });
      if (error.message === "PLACEMENT_OWNERSHIP_CONFLICT") return NextResponse.json({ success: false, error: "This video's comparison record needs an ownership review." }, { status: 409 });
      if (error.message === "INVALID_POSTER") return NextResponse.json({ success: false, error: "Keep the existing poster or clear it to use the video thumbnail." }, { status: 400 });
    }
    console.error("Unable to update film comparison classification:", error);
    return NextResponse.json({ success: false, error: "The film comparison classification could not be saved." }, { status: 500 });
  }
}
