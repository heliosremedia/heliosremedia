import { requireAdminSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { previousMonth } from "@/lib/monthly-summaries/core";
import MonthlySummaries from "./MonthlySummaries";
export const dynamic = "force-dynamic";
export default async function MonthlySummariesPage() {
  const session = await requireAdminSession();
  if (!["OWNER", "ADMIN"].includes(session.role)) notFound();
  return <AdminPageLayout header={<AdminPageHeader eyebrow="Email Studio" title="Monthly Media Summaries" description="A thoughtful look back at each client’s media purchases." />}><MonthlySummaries initialMonth={previousMonth()} isOwner={session.role === "OWNER"} /></AdminPageLayout>;
}
