import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function label(value: unknown, fallback: string) { const clean = typeof value === "string" ? value.trim().slice(0, 80) : ""; return clean || fallback; }
function mode(value: unknown) { return value === "CURATED" || value === "NEWEST" ? value : "ROTATING_MIX"; }
function ids(value: unknown) { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length < 80))].slice(0, 1000) : []; }

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const requestedProjectIds = ids(body.excludedProjectIds);
  const requestedMediaIds = ids(body.excludedMediaIds);
  const [projects, media] = await Promise.all([
    prisma.project.findMany({ where: { workspaceId: session.workspaceId, id: { in: requestedProjectIds } }, select: { id: true } }),
    prisma.media.findMany({ where: { id: { in: requestedMediaIds }, project: { workspaceId: session.workspaceId } }, select: { id: true } }),
  ]);
  if (projects.length !== requestedProjectIds.length || media.length !== requestedMediaIds.length) return NextResponse.json({ success: false, error: "One or more exclusions do not belong to this workspace." }, { status: 400 });
  const data = {
    photoEnabled: body.photoEnabled !== false,
    filmEnabled: body.filmEnabled !== false,
    photoButtonLabel: label(body.photoButtonLabel, "Browse All Photography"),
    filmButtonLabel: label(body.filmButtonLabel, "Watch All Films"),
    photoOrderingMode: mode(body.photoOrderingMode),
    filmOrderingMode: mode(body.filmOrderingMode),
    initialItemCount: Math.min(48, Math.max(6, Number.parseInt(String(body.initialItemCount || 24), 10) || 24)),
    excludedProjectIds: requestedProjectIds,
    excludedMediaIds: requestedMediaIds,
  };
  await prisma.auditEvent.create({ data: { actorId: session.userId, actorEmail: session.email, action: "PORTFOLIO_DISCOVERY_SETTINGS_UPDATED", entityType: "PortfolioDiscoverySettings", entityId: session.workspaceId, summary: "Updated Portfolio quick-browse settings.", metadata: data } });
  revalidatePath("/portfolio"); revalidatePath("/portfolio/gallery"); revalidatePath("/portfolio/films"); revalidatePath("/admin/projects");
  return NextResponse.json({ success: true, settings: data });
}
