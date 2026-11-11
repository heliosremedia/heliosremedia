import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { loadFeedbackDashboard } from "@/lib/feedback-server";
import { FeedbackError } from "@/lib/feedback";
import FeedbackWorkspace from "./FeedbackWorkspace";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const session = await requireAdminSession();
  if (!["OWNER", "ADMIN"].includes(session.role)) notFound();
  const dashboard = await loadFeedbackDashboard(session).catch((error: unknown) => {
    if (error instanceof FeedbackError && error.status === 403) notFound();
    throw error;
  });
  return <AdminPageLayout header={<AdminPageHeader eyebrow="Client experience" title="Client Feedback" description="Listen to your clients. Keep the survey, its results, and thoughtful reminders together." actions={<Link href="/admin/email-studio" className="text-sm text-white/60 hover:text-white">← Email Studio</Link>} />}>
    <FeedbackWorkspace initialDashboard={dashboard} />
  </AdminPageLayout>;
}
