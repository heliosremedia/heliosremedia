import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import CampaignWorkspace from "../../components/CampaignWorkspace";

export const dynamic = "force-dynamic";

export default async function ReferralCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  const { campaignId } = await params;
  return <CampaignWorkspace campaignId={campaignId} adminEmail={session.email} />;
}
