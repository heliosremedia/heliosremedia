import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import VideoOfferingManager from "./VideoOfferingManager";

export const dynamic = "force-dynamic";

export default async function VideoOfferingsPage() {
  const session = await requireAdminSession();
  const offerings = await prisma.videoOffering.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: [{ offeringGroup: "asc" }, { comparisonOrder: "asc" }],
    include: { placements: { where: { showOnComparison: true, media: { visibility: "VISIBLE", project: { status: "PUBLISHED", workspaceId: session.workspaceId } } }, select: { id: true } } },
  });
  return <div className="space-y-7 pb-12"><section className="border-b border-white/[.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Film Comparison</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Managed film and reel offerings</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Edit public positioning and review example readiness. Classify individual videos from each project’s Media editor.</p></section><VideoOfferingManager initialOfferings={offerings.map(({ placements, ...item }) => ({ ...item, eligibleExamples: placements.length }))} /></div>;
}
