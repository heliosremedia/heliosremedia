import Link from "next/link";
import { getPublishingQueue } from "@/lib/social/publishing-review";
import PublishingQueue from "./PublishingQueue";
import { getAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PublishingQueuePage() {
  const session=await getAdminSession();if(!session)redirect("/login");
  let jobs: Awaited<ReturnType<typeof getPublishingQueue>>;
  try { jobs = await getPublishingQueue(session); }
  catch (error) { if (error instanceof Error && error.message === 'WORKSPACE_WRITE_FORBIDDEN') redirect('/admin'); throw error; }
  return <div className="space-y-7 pb-10">
    <section className="border-b border-white/[.08] pb-7">
      <Link href="/admin/social-studio" className="text-xs text-white/35">← Social Studio</Link>
      <p className="eyebrow mt-5 text-[var(--helios-orange)]">Publishing operations</p>
      <h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Publishing queue</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Inspect recorded submissions and approval revisions. Uncertain outcomes require reconciliation before any retry. No account is enabled by default.</p>
    </section>
    <PublishingQueue initialJobs={jobs}/>
  </div>;
}
