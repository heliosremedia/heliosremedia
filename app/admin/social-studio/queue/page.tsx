import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PublishingQueue from "./PublishingQueue";

export const dynamic = "force-dynamic";

export default async function PublishingQueuePage() {
  const jobs = await prisma.socialPublishingJob.findMany({
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      connection: { select: { platform: true, intendedAccountName: true, providerUsername: true } },
      variant: { select: { id: true, campaignId: true, postType: true, campaign: { select: { internalName: true } } } },
    },
  });
  return <div className="space-y-7 pb-10">
    <section className="border-b border-white/[.08] pb-7">
      <Link href="/admin/social-studio" className="text-xs text-white/35">← Social Studio</Link>
      <p className="eyebrow mt-5 text-[var(--helios-orange)]">Publishing operations</p>
      <h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Publishing queue</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Every automated submission is revision-locked, idempotent, and independently recoverable. No account is enabled by default.</p>
    </section>
    <PublishingQueue initialJobs={jobs.map((job) => ({
      id: job.id, campaign: job.variant.campaign.internalName, campaignId: job.variant.campaignId, variantId: job.variant.id,
      platform: job.connection.platform, account: job.connection.providerUsername || job.connection.intendedAccountName || "Unconfigured account",
      postType: job.variant.postType, status: job.status, scheduledAt: job.scheduledAt.toISOString(),
      attempts: job.attempts, maxAttempts: job.maxAttempts, error: job.lastErrorMessage || "", publicUrl: job.publicUrl || "",
    }))}/>
  </div>;
}

