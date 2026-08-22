import { requireAdminSession } from "@/lib/auth/session";
import { getPhotoComparisonPage } from "@/lib/photo-comparison";
import PhotoComparisonManager from "./PhotoComparisonManager";

export const dynamic = "force-dynamic";

export default async function AdminPhotoComparisonPage() {
  const session = await requireAdminSession();
  const page = await getPhotoComparisonPage(session.workspaceId);
  return <div className="space-y-7 pb-12"><section className="border-b border-white/[.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Photo Comparison</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Standard and Editorial finishes</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Manage the public comparison page, replace paired images, control messaging, and publish without changing the protected page design.</p></section><PhotoComparisonManager initialPage={page} /></div>;
}
