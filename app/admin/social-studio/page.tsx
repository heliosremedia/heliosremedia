import { prisma } from "@/lib/prisma";
import { deriveCampaignStatus } from "@/lib/social/core";
import SocialDashboard from "./SocialDashboard";

export const dynamic = "force-dynamic";

export default async function SocialStudioPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [campaignRows, projects, blogs, newsletters, counts] = await Promise.all([
    prisma.socialCampaign.findMany({ where: { archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 40, include: { variants: { select: { id: true, platform: true, postType: true, status: true, scheduledAt: true } } } }),
    prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, locationLabel: true } }),
    prisma.blogPost.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 100, select: { id: true, title: true } }),
    prisma.newsletterEdition.findMany({ where: { status: "SENT" }, orderBy: { intendedSendAt: "desc" }, take: 100, select: { id: true, subject: true } }),
    Promise.all([
      prisma.socialCampaign.count({ where: { archivedAt: null, variants: { some: { status: "DRAFT" } } } }),
      prisma.socialVariant.count({ where: { status: "NEEDS_REVIEW" } }),
      prisma.socialVariant.count({ where: { status: "APPROVED" } }),
      prisma.socialVariant.count({ where: { status: "SCHEDULED" } }),
      prisma.socialVariant.count({ where: { status: "READY_TO_PUBLISH" } }),
      prisma.socialVariant.count({ where: { status: "PUBLISHED" } }),
      prisma.socialVariant.count({ where: { status: "PUBLISHED", publishedAt: { gte: monthStart } } }),
    ]),
  ]);
  const campaigns = campaignRows.map((item) => ({
    id: item.id, internalName: item.internalName, updatedAt: item.updatedAt.toISOString(),
    status: deriveCampaignStatus(item.variants.map((variant) => variant.status)),
    variants: item.variants.map((variant) => ({ ...variant, scheduledAt: variant.scheduledAt?.toISOString() || null })),
  }));
  return <div className="space-y-7 pb-10"><SocialDashboard campaigns={campaigns} projects={projects.map((item) => ({ id: item.id, label: `${item.title}${item.locationLabel ? ` · ${item.locationLabel}` : ""}` }))} blogs={blogs.map((item) => ({ id: item.id, label: item.title }))} newsletters={newsletters.map((item) => ({ id: item.id, label: item.subject || "Untitled edition" }))} summary={{ draft_campaigns: counts[0], awaiting_review: counts[1], approved: counts[2], scheduled: counts[3], ready_to_publish: counts[4], published: counts[5], published_this_month: counts[6] }}/></div>;
}
