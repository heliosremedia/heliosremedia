import { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
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
  return <div className="space-y-7 pb-12"><AdminPageHeader eyebrow="Film Comparison" title="Managed film and reel offerings" description="Edit public positioning and review example readiness. Classify individual videos from each project’s Media editor." /><VideoOfferingManager initialOfferings={offerings.map(({ placements, ...item }) => ({ ...item, eligibleExamples: placements.length }))} /></div>;
}
