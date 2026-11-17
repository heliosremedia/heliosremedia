import { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { requireAdminSession } from "@/lib/auth/session";
import { getPhotoComparisonPage } from "@/lib/photo-comparison";
import PhotoComparisonManager from "./PhotoComparisonManager";

export const dynamic = "force-dynamic";

export default async function AdminPhotoComparisonPage() {
  const session = await requireAdminSession();
  const page = await getPhotoComparisonPage(session.workspaceId);
  return <div className="space-y-7 pb-12"><AdminPageHeader eyebrow="Photo Comparison" title="Standard and Editorial finishes" description="Manage the public comparison page, replace paired images, control messaging, and publish without changing the protected page design." /><PhotoComparisonManager initialPage={page} /></div>;
}
