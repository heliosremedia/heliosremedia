import { prisma } from "@/lib/prisma";
import {
  communicationMetrics,
  dedupeAttention,
  previousPeriod,
  type DashboardAttention,
  type DashboardEvent,
} from "./dashboard-core";

export const HELIOS_TIME_ZONE = "America/Denver";

type Section<T> = { available: true; data: T } | { available: false; data: T };

async function section<T>(fallback: T, load: () => Promise<T>): Promise<Section<T>> {
  try {
    return { available: true, data: await load() };
  } catch (error) {
    console.error("Dashboard section could not be loaded:", error);
    return { available: false, data: fallback };
  }
}

export async function getDashboardData(days = 30) {
  const now = new Date();
  const rangeStart = new Date(now.getTime() - days * 86_400_000);
  const rangeEnd = now;
  const prior = previousPeriod(rangeStart, rangeEnd);
  const upcomingEnd = new Date(now.getTime() + 14 * 86_400_000);

  const [operations, communications, content, relationships, website, activity] =
    await Promise.all([
      section(
        { attention: [] as DashboardAttention[], upcoming: [] as DashboardEvent[], bookingMode: null as string | null },
        async () => {
          const [
            newsletters,
            blogs,
            inquiries,
            failedCampaigns,
            failedJobs,
            newsletterSchedule,
            emailSchedule,
            blogSchedule,
            blogSeries,
            referralSchedule,
            socialAttention,
            socialSchedule,
            settings,
          ] = await Promise.all([
            prisma.newsletterEdition.findMany({
              where: {
                status: {
                  in: ["NEEDS_REVIEW", "MISSED_APPROVAL", "GENERATION_FAILED", "SEND_FAILED", "PARTIALLY_SENT"],
                },
              },
              select: { id: true, subject: true, status: true, intendedSendAt: true },
              take: 12,
              orderBy: { intendedSendAt: "asc" },
            }),
            prisma.blogPost.findMany({
              where: { status: "NEEDS_REVIEW" },
              select: { id: true, title: true, updatedAt: true, intendedPublishAt: true },
              take: 8,
              orderBy: { updatedAt: "asc" },
            }),
            prisma.inquiry.findMany({
              where: { status: "NEW" },
              select: { id: true, name: true, createdAt: true },
              take: 10,
              orderBy: { createdAt: "asc" },
            }),
            prisma.emailCampaign.findMany({
              where: {
                OR: [
                  { status: { in: ["FAILED", "PARTIAL"] } },
                  { scheduleError: { not: null } },
                ],
              },
              select: { id: true, subject: true, status: true, updatedAt: true },
              take: 8,
              orderBy: { updatedAt: "desc" },
            }),
            prisma.newsletterJob.findMany({
              where: { status: "FAILED" },
              select: { id: true, editionId: true, type: true, updatedAt: true },
              take: 8,
              orderBy: { updatedAt: "desc" },
            }),
            prisma.newsletterEdition.findMany({
              where: {
                intendedSendAt: { gte: now, lte: upcomingEnd },
                status: { notIn: ["CANCELLED", "SENT", "PAUSED"] },
              },
              select: { id: true, subject: true, intendedSendAt: true, generationDueAt: true, status: true },
              orderBy: { intendedSendAt: "asc" },
            }),
            prisma.emailCampaign.findMany({
              where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: upcomingEnd } },
              select: { id: true, subject: true, scheduledAt: true, status: true },
              orderBy: { scheduledAt: "asc" },
            }),
            prisma.blogPost.findMany({
              where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: upcomingEnd } },
              select: { id: true, title: true, scheduledAt: true, status: true },
              orderBy: { scheduledAt: "asc" },
            }),
            prisma.blogSeries.findMany({
              where: { status: "ACTIVE", nextGenerationAt: { gte: now, lte: upcomingEnd } },
              select: { id: true, name: true, nextGenerationAt: true },
              orderBy: { nextGenerationAt: "asc" },
            }),
            prisma.referralCampaign.findMany({
              where: {
                status: { in: ["APPROVED", "ACTIVE"] },
                OR: [
                  { startsAt: { gte: now, lte: upcomingEnd } },
                  { endsAt: { gte: now, lte: upcomingEnd } },
                ],
              },
              select: { id: true, internalName: true, status: true, startsAt: true, endsAt: true },
            }),
            prisma.socialVariant.findMany({
              where: {
                OR: [
                  { status: { in: ["NEEDS_REVIEW", "READY_TO_PUBLISH", "FAILED"] } },
                  { status: "SCHEDULED", scheduledAt: { lt: now } },
                  { status: "APPROVED", scheduledAt: null },
                ],
              },
              select: { id: true, platform: true, status: true, scheduledAt: true, updatedAt: true, campaignId: true, campaign: { select: { internalName: true, generationStatus: true } } },
              take: 16,
              orderBy: { updatedAt: "asc" },
            }),
            prisma.socialVariant.findMany({
              where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: upcomingEnd } },
              select: { id: true, platform: true, postType: true, status: true, scheduledAt: true, campaignId: true, campaign: { select: { internalName: true } } },
              orderBy: { scheduledAt: "asc" },
            }),
            prisma.siteSettings.findUnique({
              where: { id: "default" },
              select: { bookingMode: true, bookingEstimatedRestoreAt: true },
            }),
          ]);

          const attention = dedupeAttention([
            ...newsletters.map((item) => ({
              id: `newsletter:${item.id}`,
              severity: (["SEND_FAILED", "GENERATION_FAILED", "MISSED_APPROVAL"].includes(item.status)
                ? "critical"
                : "attention") as DashboardAttention["severity"],
              type: "Newsletter",
              message: `${item.subject || "Untitled edition"} · ${item.status.replaceAll("_", " ").toLowerCase()}`,
              date: item.intendedSendAt,
              href: `/admin/newsletter-studio/editions/${item.id}`,
              action: "Review newsletter",
            })),
            ...blogs.map((item) => ({
              id: `blog:${item.id}`,
              severity: "attention" as const,
              type: "Blog",
              message: `${item.title} is awaiting review`,
              date: item.intendedPublishAt || item.updatedAt,
              href: `/admin/blog?post=${item.id}`,
              action: "Open draft",
            })),
            ...inquiries.map((item) => ({
              id: `inquiry:${item.id}`,
              severity: "attention" as const,
              type: "Inquiry",
              message: `New inquiry from ${item.name}`,
              date: item.createdAt,
              href: `/admin/inquiries?inquiry=${item.id}`,
              action: "Respond",
            })),
            ...failedCampaigns.map((item) => ({
              id: `email:${item.id}`,
              severity: "critical" as const,
              type: "Email",
              message: `${item.subject} has a delivery or scheduling issue`,
              date: item.updatedAt,
              href: `/admin/email-studio?campaign=${item.id}`,
              action: "Review campaign",
            })),
            ...failedJobs.map((item) => ({
              id: `job:${item.id}`,
              severity: "critical" as const,
              type: "Scheduled job",
              message: `${item.type.toLowerCase()} job failed`,
              date: item.updatedAt,
              href: `/admin/newsletter-studio/editions/${item.editionId}`,
              action: "Review job",
            })),
            ...socialAttention.map((item) => ({
              id: `social:${item.id}`,
              severity: (item.status === "FAILED" || (item.status === "SCHEDULED" && item.scheduledAt && item.scheduledAt < now) ? "critical" : "attention") as DashboardAttention["severity"],
              type: "Social",
              message: `${item.campaign.internalName} · ${item.platform.toLowerCase()} · ${item.status.replaceAll("_", " ").toLowerCase()}`,
              date: item.scheduledAt || item.updatedAt,
              href: `/admin/social-studio/campaigns/${item.campaignId}?variant=${item.id}`,
              action: item.status === "READY_TO_PUBLISH" ? "Publish manually" : "Open post",
            })),
            ...(settings?.bookingMode && settings.bookingMode !== "ONLINE"
              ? [{
                  id: "booking:mode",
                  severity: "info" as const,
                  type: "Booking",
                  message: `Online booking is ${settings.bookingMode.toLowerCase()}`,
                  date: settings.bookingEstimatedRestoreAt || now,
                  href: "/admin/settings",
                  action: "Manage status",
                }]
              : []),
          ]);

          const upcoming: DashboardEvent[] = [
            ...newsletterSchedule.flatMap((item) => [
              ...(item.generationDueAt && item.generationDueAt >= now
                ? [{
                    id: `newsletter-generation:${item.id}`,
                    type: "Newsletter",
                    title: `${item.subject || "Edition"} generation`,
                    date: item.generationDueAt,
                    href: `/admin/newsletter-studio/editions/${item.id}`,
                    state: "Generate",
                  }]
                : []),
              {
                id: `newsletter-send:${item.id}`,
                type: "Newsletter",
                title: item.subject || "Newsletter edition",
                date: item.intendedSendAt,
                href: `/admin/newsletter-studio/editions/${item.id}`,
                state: item.status.replaceAll("_", " "),
              },
            ]),
            ...emailSchedule.flatMap((item) =>
              item.scheduledAt
                ? [{
                    id: `email:${item.id}`,
                    type: "Email",
                    title: item.subject,
                    date: item.scheduledAt,
                    href: `/admin/email-studio?campaign=${item.id}`,
                    state: "Scheduled",
                  }]
                : [],
            ),
            ...blogSchedule.flatMap((item) =>
              item.scheduledAt
                ? [{
                    id: `blog:${item.id}`,
                    type: "Blog",
                    title: item.title,
                    date: item.scheduledAt,
                    href: `/admin/blog?post=${item.id}`,
                    state: "Publish",
                  }]
                : [],
            ),
            ...blogSeries.flatMap((item) =>
              item.nextGenerationAt
                ? [{
                    id: `blog-series:${item.id}`,
                    type: "Blog",
                    title: `${item.name} draft generation`,
                    date: item.nextGenerationAt,
                    href: "/admin/blog",
                    state: "Generate",
                  }]
                : [],
            ),
            ...referralSchedule.flatMap((item) => [
              ...(item.startsAt && item.startsAt >= now
                ? [{
                    id: `referral-start:${item.id}`,
                    type: "Referral",
                    title: `${item.internalName} begins`,
                    date: item.startsAt,
                    href: `/admin/referral-studio/campaigns/${item.id}`,
                    state: "Starts",
                  }]
                : []),
              ...(item.endsAt && item.endsAt >= now
                ? [{
                    id: `referral-end:${item.id}`,
                    type: "Referral",
                    title: `${item.internalName} ends`,
                    date: item.endsAt,
                    href: `/admin/referral-studio/campaigns/${item.id}`,
                    state: "Ends",
                  }]
                : []),
            ]),
            ...socialSchedule.flatMap((item) => item.scheduledAt ? [{
              id: `social:${item.id}`,
              type: "Social",
              title: `${item.campaign.internalName} · ${item.platform}`,
              date: item.scheduledAt,
              href: `/admin/social-studio/campaigns/${item.campaignId}?variant=${item.id}`,
              state: item.status.replaceAll("_", " "),
            }] : []),
            ...(settings?.bookingEstimatedRestoreAt &&
            settings.bookingEstimatedRestoreAt >= now &&
            settings.bookingEstimatedRestoreAt <= upcomingEnd
              ? [{
                  id: "booking:restore",
                  type: "Booking",
                  title: "Estimated booking restoration",
                  date: settings.bookingEstimatedRestoreAt,
                  href: "/admin/settings",
                  state: "Planned",
                }]
              : []),
          ].sort((a, b) => a.date.getTime() - b.date.getTime());
          return { attention, upcoming, bookingMode: settings?.bookingMode || null };
        },
      ),
      section(
        {
          campaigns: 0,
          metrics: communicationMetrics([]),
          priorDeliveryRate: null as number | null,
          newsletterCampaigns: 0,
          bestCampaign: null as null | { id: string; subject: string; clicks: number; newsletterEditionId: string | null },
        },
        async () => {
          const [campaigns, priorCampaigns] = await Promise.all([
            prisma.emailCampaign.findMany({
              where: { sentAt: { gte: rangeStart, lte: rangeEnd } },
              select: {
                id: true,
                subject: true,
                newsletterDelivery: { select: { editionId: true } },
                recipients: {
                  select: {
                    id: true,
                    status: true,
                    events: { select: { eventType: true, linkUrl: true } },
                  },
                },
              },
            }),
            prisma.emailCampaign.findMany({
              where: { sentAt: { gte: prior.start, lt: prior.end } },
              select: {
                recipients: {
                  select: {
                    id: true,
                    status: true,
                    events: { select: { eventType: true, linkUrl: true } },
                  },
                },
              },
            }),
          ]);
          const metrics = communicationMetrics(campaigns.flatMap((item) => item.recipients));
          const priorMetrics = communicationMetrics(priorCampaigns.flatMap((item) => item.recipients));
          const ranked = campaigns
            .map((campaign) => ({
              id: campaign.id,
              subject: campaign.subject,
              clicks: communicationMetrics(campaign.recipients).uniqueClicks,
              newsletterEditionId: campaign.newsletterDelivery?.editionId || null,
            }))
            .sort((a, b) => b.clicks - a.clicks);
          return {
            campaigns: campaigns.length,
            metrics,
            priorDeliveryRate: priorCampaigns.length ? priorMetrics.deliveryRate : null,
            newsletterCampaigns: campaigns.filter((item) => item.newsletterDelivery).length,
            bestCampaign: ranked[0] || null,
          };
        },
      ),
      section(
        {
          publishedBlogs: 0,
          blogDrafts: 0,
          activeBlogSeries: 0,
          activeNewsletterSeries: 0,
          newsletterReviews: 0,
          nextBlog: null as Date | null,
          nextNewsletter: null as Date | null,
          socialDraftCampaigns: 0,
          socialPlanned: 0,
          socialPublishedThisMonth: 0,
        },
        async () => {
          const [
            publishedBlogs,
            blogDrafts,
            activeBlogSeries,
            activeNewsletterSeries,
            newsletterReviews,
            nextBlogSeries,
            nextNewsletterSeries,
            socialDraftCampaigns,
            socialPlanned,
            socialPublishedThisMonth,
          ] = await Promise.all([
            prisma.blogPost.count({ where: { status: "PUBLISHED", publishedAt: { gte: rangeStart } } }),
            prisma.blogPost.count({ where: { status: { in: ["DRAFT", "NEEDS_REVIEW"] } } }),
            prisma.blogSeries.count({ where: { status: "ACTIVE" } }),
            prisma.newsletterSeries.count({ where: { status: "ACTIVE" } }),
            prisma.newsletterEdition.count({ where: { status: "NEEDS_REVIEW" } }),
            prisma.blogSeries.findFirst({ where: { status: "ACTIVE", nextGenerationAt: { not: null } }, orderBy: { nextGenerationAt: "asc" }, select: { nextGenerationAt: true } }),
            prisma.newsletterSeries.findFirst({ where: { status: "ACTIVE", nextGenerationAt: { not: null } }, orderBy: { nextGenerationAt: "asc" }, select: { nextGenerationAt: true } }),
            prisma.socialCampaign.count({ where: { archivedAt: null, variants: { some: { status: { in: ["DRAFT", "NEEDS_REVIEW"] } } } } }),
            prisma.socialVariant.count({ where: { status: { in: ["APPROVED", "SCHEDULED", "READY_TO_PUBLISH"] } } }),
            prisma.socialVariant.count({ where: { status: "PUBLISHED", publishedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } } }),
          ]);
          return {
            publishedBlogs,
            blogDrafts,
            activeBlogSeries,
            activeNewsletterSeries,
            newsletterReviews,
            nextBlog: nextBlogSeries?.nextGenerationAt || null,
            nextNewsletter: nextNewsletterSeries?.nextGenerationAt || null,
            socialDraftCampaigns,
            socialPlanned,
            socialPublishedThisMonth,
          };
        },
      ),
      section(
        {
          clients: 0,
          eligibleClients: 0,
          groups: 0,
          lastSync: null as Date | null,
          activeReferrals: 0,
          advocates: 0,
          qualifiedReferrals: 0,
          issuedRewards: 0,
        },
        async () => {
          const [clients, eligibleClients, groups, lastSync, activeReferrals, advocates, qualifiedReferrals, issuedRewards] =
            await Promise.all([
              prisma.communicationClient.count({ where: { archivedAt: null } }),
              prisma.communicationClient.count({ where: { archivedAt: null, emailSubscribed: true, emailStatus: "VALID" } }),
              prisma.communicationGroup.count(),
              prisma.communicationClient.aggregate({ _max: { lastSyncedAt: true } }),
              prisma.referralCampaign.count({ where: { status: "ACTIVE" } }),
              prisma.referralAdvocate.count({ where: { campaign: { status: "ACTIVE" }, includedAt: { not: null } } }),
              prisma.referralSubmission.count({ where: { status: { in: ["QUALIFIED", "BOOKED", "COMPLETED", "REWARD_ELIGIBLE", "REWARD_ISSUED"] } } }),
              prisma.referralReward.count({ where: { status: "ISSUED" } }),
            ]);
          return { clients, eligibleClients, groups, lastSync: lastSync._max.lastSyncedAt, activeReferrals, advocates, qualifiedReferrals, issuedRewards };
        },
      ),
      section(
        {
          totalProjects: 0,
          publishedProjects: 0,
          draftProjects: 0,
          assets: 0,
          newInquiries: 0,
          unansweredInquiries: 0,
          recentProjects: [] as Array<{ id: string; title: string; city: string | null; state: string | null; status: string; updatedAt: Date }>,
        },
        async () => {
          const [totalProjects, publishedProjects, draftProjects, assets, newInquiries, unansweredInquiries, recentProjects] =
            await Promise.all([
              prisma.project.count(),
              prisma.project.count({ where: { status: "PUBLISHED" } }),
              prisma.project.count({ where: { status: "DRAFT" } }),
              prisma.media.count(),
              prisma.inquiry.count({ where: { status: "NEW", createdAt: { gte: rangeStart } } }),
              prisma.inquiry.count({ where: { status: "NEW" } }),
              prisma.project.findMany({
                take: 5,
                orderBy: { updatedAt: "desc" },
                select: { id: true, title: true, city: true, state: true, status: true, updatedAt: true },
              }),
            ]);
          return { totalProjects, publishedProjects, draftProjects, assets, newInquiries, unansweredInquiries, recentProjects };
        },
      ),
      section(
        [] as Array<{ id: string; action: string; summary: string; createdAt: Date; href: string }>,
        async () => {
          const [audit, inquiries, referrals] = await Promise.all([
            prisma.auditEvent.findMany({
              take: 10,
              orderBy: { createdAt: "desc" },
              select: { id: true, action: true, summary: true, entityType: true, entityId: true, createdAt: true },
            }),
            prisma.inquiryActivity.findMany({
              take: 6,
              orderBy: { createdAt: "desc" },
              select: { id: true, action: true, summary: true, inquiryId: true, createdAt: true },
            }),
            prisma.referralAuditEvent.findMany({
              take: 6,
              orderBy: { createdAt: "desc" },
              select: { id: true, action: true, summary: true, campaignId: true, submissionId: true, createdAt: true },
            }),
          ]);
          return [
            ...audit.map((item) => ({
              id: `audit:${item.id}`,
              action: item.action,
              summary: item.summary,
              createdAt: item.createdAt,
              href: item.entityType === "Project" && item.entityId ? `/admin/projects/${item.entityId}` : "/admin/activity",
            })),
            ...inquiries.map((item) => ({
              id: `inquiry:${item.id}`,
              action: item.action,
              summary: item.summary,
              createdAt: item.createdAt,
              href: `/admin/inquiries?inquiry=${item.inquiryId}`,
            })),
            ...referrals.map((item) => ({
              id: `referral:${item.id}`,
              action: item.action,
              summary: item.summary,
              createdAt: item.createdAt,
              href: item.submissionId
                ? `/admin/referral-studio/referrals/${item.submissionId}`
                : item.campaignId
                  ? `/admin/referral-studio/campaigns/${item.campaignId}`
                  : "/admin/referral-studio",
            })),
          ]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10);
        },
      ),
    ]);

  return {
    generatedAt: now,
    days,
    operations,
    communications,
    content,
    relationships,
    website,
    activity,
  };
}
