import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import EventStudio from "./EventStudio";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const session = await requireAdminSession();
  if (!["OWNER", "ADMIN"].includes(session.role)) notFound();
  return <AdminPageLayout header={<AdminPageHeader eyebrow="Client communications" title="Event Invitations" description="Bring your clients together. Prepare an invitation, collect RSVPs, and keep the right guests in the loop." actions={<Link href="/admin/email-studio" className="text-sm text-white/60 hover:text-white">← Email Studio</Link>} />}>
    <EventStudio defaultTestEmail={session.email} />
  </AdminPageLayout>;
}
