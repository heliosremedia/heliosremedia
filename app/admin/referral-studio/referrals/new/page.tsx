import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import ManualReferralForm from "../../components/ManualReferralForm";

export default async function NewManualReferralPage() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  return <ManualReferralForm />;
}
