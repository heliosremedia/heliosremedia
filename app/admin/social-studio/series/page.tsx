import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces";
import SocialSeriesManager from "./SocialSeriesManager";

export const dynamic = "force-dynamic";

export default async function SocialSeriesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  const workspaceId = await requireWorkspaceId(session.userId);
  const rows = await prisma.socialSeries.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { occurrences: true, campaigns: true } } },
  });
  return <SocialSeriesManager series={rows.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description || "",
    frequency: item.frequency,
    status: item.status,
    platforms: Array.isArray(item.defaultPlatforms) ? item.defaultPlatforms.filter((value): value is string => typeof value === "string") : [],
    occurrences: item._count.occurrences,
    campaigns: item._count.campaigns,
    generationThrough: item.generationThrough?.toISOString() || null,
  }))}/>;
}
