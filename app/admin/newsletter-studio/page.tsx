import { requireNewsletterAdministrator } from "@/lib/newsletters/api";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { redirect } from "next/navigation";
import NewsletterDashboard from "./components/NewsletterDashboard";
import AdminSummaryCards from "@/app/admin/components/AdminSummaryCards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function NewsletterStudioPage() {
  const session = await requireNewsletterAdministrator();
  if (!session) redirect("/admin");
  const ownershipScope = await getContentOwnershipScope(session.workspaceId);
  const [activeSeries, needsReview, scheduled, sent] = await Promise.all([
    prisma.newsletterSeries.count({ where: { status: "ACTIVE", AND: [ownershipScope] } }),
    prisma.newsletterEdition.count({ where: { status: { in: ["NEEDS_REVIEW","MISSED_APPROVAL"] }, series: ownershipScope } }),
    prisma.newsletterEdition.count({ where: { status: "SCHEDULED", series: ownershipScope } }),
    prisma.newsletterEdition.count({ where: { status: "SENT", series: ownershipScope } }),
  ]);
  return <NewsletterDashboard summary={<AdminSummaryCards items={[
    { label: "Active series", value: activeSeries, detail: "Currently running", tone: "good" },
    { label: "Needs review", value: needsReview, detail: "Awaiting attention", tone: needsReview?"warning":"neutral" },
    { label: "Scheduled", value: scheduled, detail: "Approved for delivery" },
    { label: "Sent", value: sent, detail: "Recorded editions" },
  ]}/>}/>;
}
