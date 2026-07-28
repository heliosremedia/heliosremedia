import { prisma } from "@/lib/prisma";
import SocialCalendar from "./SocialCalendar";
import { getAdminSession } from "@/lib/auth/session";
import { requireWorkspaceId } from "@/lib/workspaces";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function SocialCalendarPage() {
  const session=await getAdminSession();if(!session)redirect("/login");const workspaceId=await requireWorkspaceId(session.userId);
  const [variants, occurrences] = await Promise.all([
    prisma.socialVariant.findMany({ where: { campaign:{workspaceId},scheduledAt: { not: null }, status: { not: "ARCHIVED" } }, orderBy: { scheduledAt: "asc" }, include: { campaign: { select: { internalName: true } } } }),
    prisma.socialSeriesOccurrence.findMany({ where: { series: { workspaceId, status: "ACTIVE" }, variantId: null }, orderBy: { scheduledAt: "asc" }, include: { series: { select: { id: true, name: true } } } }),
  ]);
  return <SocialCalendar items={[
    ...variants.map((item) => ({ id: item.id, campaignId: item.campaignId, campaign: item.campaign.internalName, seriesId: null, series: null, platform: item.platform, postType: item.postType, status: item.status, scheduledAt: item.scheduledAt!.toISOString(), plannedOnly: false })),
    ...occurrences.map((item) => ({ id: item.id, campaignId: null, campaign: item.series.name, seriesId: item.seriesId, series: item.series.name, platform: item.platform, postType: "SERIES_OCCURRENCE", status: "PLANNED", scheduledAt: item.scheduledAt.toISOString(), plannedOnly: true })),
  ]}/>;
}
