import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import ReferralDetail from "../../components/ReferralDetail";

export const dynamic = "force-dynamic";

export default async function ReferralDetailPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  const { submissionId } = await params;
  return <ReferralDetail submissionId={submissionId} />;
}
