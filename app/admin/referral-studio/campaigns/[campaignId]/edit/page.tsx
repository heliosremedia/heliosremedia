import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import CampaignBuilder from "../../../components/CampaignBuilder";

export const dynamic = "force-dynamic";

export default async function EditReferralCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  const { campaignId } = await params;
  const campaign = await prisma.referralCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) notFound();
  if (campaign.status !== "DRAFT") redirect(`/admin/referral-studio/campaigns/${campaignId}`);
  const serialized = JSON.parse(JSON.stringify(campaign)) as Parameters<typeof CampaignBuilder>[0]["initialCampaign"];
  return <CampaignBuilder adminEmail={session.email} initialClientId="" initialCampaign={serialized} />;
}
