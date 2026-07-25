import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import CampaignBuilder from "../../components/CampaignBuilder";

export const dynamic = "force-dynamic";

export default async function NewReferralCampaignPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  const { clientId } = await searchParams;
  return <CampaignBuilder adminEmail={session.email} initialClientId={clientId || ""} />;
}
