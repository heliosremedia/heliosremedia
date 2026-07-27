import { prisma } from "@/lib/prisma";
import SocialCalendar from "./SocialCalendar";
import { getAdminSession } from "@/lib/auth/session";
import { requireWorkspaceId } from "@/lib/workspaces";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function SocialCalendarPage() {
  const session=await getAdminSession();if(!session)redirect("/login");const workspaceId=await requireWorkspaceId(session.userId);
  const variants = await prisma.socialVariant.findMany({ where: { campaign:{workspaceId},scheduledAt: { not: null }, status: { not: "ARCHIVED" } }, orderBy: { scheduledAt: "asc" }, include: { campaign: { select: { internalName: true } } } });
  return <SocialCalendar items={variants.map((item) => ({ id: item.id, campaignId: item.campaignId, campaign: item.campaign.internalName, platform: item.platform, postType: item.postType, status: item.status, scheduledAt: item.scheduledAt!.toISOString() }))}/>;
}
