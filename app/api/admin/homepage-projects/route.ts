import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const select = { id: true, projectId: true, titleOverride: true, displayOrder: true, active: true, createdAt: true, updatedAt: true, project: { select: { id: true, title: true, slug: true, status: true, locationLabel: true, heroMedia: { select: { storageKey: true, altText: true } } } } } as const;
function refresh() { revalidatePath("/"); revalidatePath("/admin/homepage"); }

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const project = await prisma.project.findFirst({ where: { id: projectId, status: "PUBLISHED" }, select: { id: true } });
    if (!project) return NextResponse.json({ success: false, error: "Only published projects can be added to the homepage." }, { status: 400 });
    const count = await prisma.homepageProject.count();
    if (count >= 1) return NextResponse.json({ success: false, error: "Remove the current Featured Project before selecting another." }, { status: 409 });
    const placement = await prisma.homepageProject.create({ data: { projectId, displayOrder: count }, select });
    refresh(); return NextResponse.json({ success: true, placement }, { status: 201 });
  } catch (error) { console.error("Unable to add homepage project:", error); return NextResponse.json({ success: false, error: "The project could not be added to the homepage." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "reorder") {
      const ids = Array.isArray(body.placementIds) ? body.placementIds.filter((id): id is string => typeof id === "string") : [];
      const current = await prisma.homepageProject.findMany({ select: { id: true } });
      if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) return NextResponse.json({ success: false, error: "Homepage curation changed before the order was saved." }, { status: 409 });
      await prisma.$transaction(ids.map((id, displayOrder) => prisma.homepageProject.update({ where: { id }, data: { displayOrder } })));
      refresh(); return NextResponse.json({ success: true, placementIds: ids });
    }
    const placementId = typeof body.placementId === "string" ? body.placementId : "";
    const titleOverride = typeof body.titleOverride === "string" && body.titleOverride.trim() ? body.titleOverride.trim() : null;
    if (!placementId || (titleOverride?.length ?? 0) > 120) return NextResponse.json({ success: false, error: "Enter a valid homepage project title." }, { status: 400 });
    const placement = await prisma.homepageProject.update({ where: { id: placementId }, data: { titleOverride, ...(typeof body.active === "boolean" ? { active: body.active } : {}) }, select });
    refresh(); return NextResponse.json({ success: true, placement });
  } catch (error) { console.error("Unable to update homepage project:", error); return NextResponse.json({ success: false, error: "The homepage project could not be updated." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try { const id = new URL(request.url).searchParams.get("placementId")?.trim(); if (!id) return NextResponse.json({ success: false, error: "A placement ID is required." }, { status: 400 }); await prisma.homepageProject.delete({ where: { id } }); refresh(); return NextResponse.json({ success: true, deletedPlacementId: id }); }
  catch (error) { console.error("Unable to remove homepage project:", error); return NextResponse.json({ success: false, error: "The homepage project could not be removed." }, { status: 500 }); }
}
