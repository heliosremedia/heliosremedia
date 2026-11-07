import { requireAdminSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import VerifyConnection from "./VerifyConnection";
export const dynamic = "force-dynamic";
export default async function VerifyPage() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER") notFound();
  return <AdminPageLayout header={<AdminPageHeader eyebrow="Email Studio" title="Verify Monthly Summary Data" description="Read the approved historical example using your existing HDPhotoHub connection." />}><VerifyConnection /></AdminPageLayout>;
}
