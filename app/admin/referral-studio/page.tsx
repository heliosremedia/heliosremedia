import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import ReferralDashboard from "./components/ReferralDashboard";

export const dynamic = "force-dynamic";

export default async function ReferralStudioPage() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  if (process.env.REFERRAL_STUDIO_ENABLED?.trim().toLowerCase() === "false") redirect("/admin");
  return <ReferralDashboard />;
}
