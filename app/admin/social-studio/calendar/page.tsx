import { prisma } from "@/lib/prisma";
import SocialCalendar from "./SocialCalendar";

export const dynamic = "force-dynamic";
export default async function SocialCalendarPage() {
  const variants = await prisma.socialVariant.findMany({ where: { scheduledAt: { not: null }, status: { not: "ARCHIVED" } }, orderBy: { scheduledAt: "asc" }, include: { campaign: { select: { internalName: true } } } });
  return <SocialCalendar items={variants.map((item) => ({ id: item.id, campaignId: item.campaignId, campaign: item.campaign.internalName, platform: item.platform, postType: item.postType, status: item.status, scheduledAt: item.scheduledAt!.toISOString() }))}/>;
}
