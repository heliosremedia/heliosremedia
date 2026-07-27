import { requireAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import NewsletterDashboard from "./components/NewsletterDashboard";
import AdminSummaryCards from "@/app/admin/components/AdminSummaryCards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function NewsletterStudioPage() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  const [activeSeries, needsReview, scheduled, sent] = await Promise.all([
    prisma.newsletterSeries.count({ where: { status: "ACTIVE" } }),
    prisma.newsletterEdition.count({ where: { status: { in: ["NEEDS_REVIEW","MISSED_APPROVAL"] } } }),
    prisma.newsletterEdition.count({ where: { status: "SCHEDULED" } }),
    prisma.newsletterEdition.count({ where: { status: "SENT" } }),
  ]);
  return <div className="space-y-7"><AdminSummaryCards items={[
    { label: "Active series", value: activeSeries, detail: "Currently running", tone: "good" },
    { label: "Needs review", value: needsReview, detail: "Awaiting attention", tone: needsReview?"warning":"neutral" },
    { label: "Scheduled", value: scheduled, detail: "Approved for delivery" },
    { label: "Sent", value: sent, detail: "Recorded editions" },
  ]}/><NewsletterDashboard /></div>;
}
