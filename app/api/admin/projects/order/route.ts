import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { projectIds?: unknown };
    const projectIds = Array.isArray(body.projectIds) ? body.projectIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
    if (!projectIds.length || projectIds.length > 500 || new Set(projectIds).size !== projectIds.length) return NextResponse.json({ success: false, error: "The project order is invalid." }, { status: 400 });
    const count = await prisma.project.count({ where: { id: { in: projectIds } } });
    if (count !== projectIds.length) return NextResponse.json({ success: false, error: "One or more projects no longer exist." }, { status: 409 });
    await prisma.$transaction(projectIds.map((id, index) => prisma.project.update({ where: { id }, data: { displayOrder: index } })));
    revalidatePath("/portfolio"); revalidatePath("/admin/projects"); revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to reorder projects:", error);
    return NextResponse.json({ success: false, error: "The project order could not be saved." }, { status: 500 });
  }
}
