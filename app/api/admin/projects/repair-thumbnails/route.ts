import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: { thumbnailMediaId: null },
    select: {
      id: true,
      heroMedia: { select: { id: true, projectId: true, sourceType: true, storageKey: true, visibility: true } },
      media: {
        where: { sourceType: "UPLOADED_IMAGE", storageKey: { not: null }, visibility: "VISIBLE" },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { id: true },
      },
    },
  });

  const repairs = projects.flatMap((project) => {
    const hero = project.heroMedia?.projectId === project.id && project.heroMedia.sourceType === "UPLOADED_IMAGE" && project.heroMedia.storageKey && project.heroMedia.visibility === "VISIBLE"
      ? project.heroMedia.id
      : null;
    const thumbnailMediaId = hero || project.media[0]?.id;
    return thumbnailMediaId ? [{ id: project.id, thumbnailMediaId }] : [];
  });

  if (repairs.length) {
    await prisma.$transaction(repairs.map(({ id, thumbnailMediaId }) =>
      prisma.project.updateMany({ where: { id, thumbnailMediaId: null }, data: { thumbnailMediaId } })
    ));
  }

  revalidatePath("/admin/projects");
  revalidatePath("/portfolio");
  return NextResponse.json({ success: true, repaired: repairs.length, unresolved: projects.length - repairs.length });
}
