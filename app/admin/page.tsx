import Link from "next/link";

import DashboardRefresh from "./components/DashboardRefresh";
import { requireAdminSession } from "@/lib/auth/session";
import { getDashboardData, HELIOS_TIME_ZONE } from "@/lib/dashboard";
import { buildBriefing } from "@/lib/dashboard-core";
import { getPublicMonitorSummary } from "@/lib/uptimerobot";

export const dynamic = "force-dynamic";

const date = (value: Date, includeTime = false) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: HELIOS_TIME_ZONE,
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(value);

const longDate = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: HELIOS_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);

const number = new Intl.NumberFormat("en-US");

function SectionError() {
  return (
    <p className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-5 text-sm text-white/35">
      This section could not be verified. Refresh to try again.
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  href,
  action,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[var(--helios-orange)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-light tracking-[-0.02em] text-white">
          {title}
        </h2>
      </div>
      {href && action ? (
        <Link
          href={href}
          className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/35 transition hover:text-white"
        >
          {action}
        </Link>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  secondary = false,
}: {
  label: string;
  value: string | number;
  detail?: string;
  secondary?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/32">
        {label}
      </p>
      <p
        className={`mt-3 font-display font-light leading-none ${secondary ? "text-2xl text-white/65" : "text-3xl text-white"}`}
      >
        {typeof value === "number" ? number.format(value) : value}
      </p>
      {detail ? (
        <p className="mt-2 text-[0.68rem] leading-5 text-white/30">{detail}</p>
      ) : null}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAdminSession();
  const requestedRange = Number((await searchParams).range);
  const days = [7, 30, 90].includes(requestedRange) ? requestedRange : 30;
  const [dashboard, publicMonitor] = await Promise.all([getDashboardData(days), getPublicMonitorSummary()]);
  const mountainHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: HELIOS_TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).format(dashboard.generatedAt),
  );
  const { operations, communications, content, relationships, website, activity } =
    dashboard;
  const briefing = buildBriefing({
    attention: operations.data.attention,
    upcoming: operations.data.upcoming,
    newInquiries: website.available ? website.data.newInquiries : null,
    deliveryRate: communications.available
      ? communications.data.metrics.deliveryRate
      : null,
    bookingMode: operations.data.bookingMode,
  });
  const canOperate = session.role === "OWNER" || session.role === "ADMIN";

  const statusItems = [
    {
      label: "Booking",
      status: operations.available
        ? operations.data.bookingMode === "ONLINE"
          ? "Online"
          : operations.data.bookingMode === "PAUSED"
            ? "Paused"
            : "Unavailable"
        : "Unknown",
      href: "/admin/settings",
      tone:
        operations.data.bookingMode === "ONLINE"
          ? "healthy"
          : operations.available
            ? "attention"
            : "unknown",
    },
    {
      label: "Email delivery",
      status: communications.available
        ? communications.data.campaigns
          ? communications.data.metrics.failed ||
            communications.data.metrics.bounces ||
            communications.data.metrics.complaints
            ? "Attention"
            : "Recent processing clear"
          : "No recent sends"
        : "Unknown",
      href: "/admin/email-studio",
      tone:
        communications.available && communications.data.campaigns
          ? communications.data.metrics.failed ||
            communications.data.metrics.bounces ||
            communications.data.metrics.complaints
            ? "attention"
            : "healthy"
          : "unknown",
    },
    {
      label: "HD Photo Hub sync",
      status: relationships.available
        ? relationships.data.lastSync
          ? `Last confirmed ${date(relationships.data.lastSync, true)}`
          : "Not verified"
        : "Unknown",
      href: "/admin/clients",
      tone: relationships.data.lastSync ? "healthy" : "unknown",
    },
    {
      label: "Public website",
      status: publicMonitor.tone === "NOT_CONFIGURED" ? "Monitoring not configured" : `${publicMonitor.tone.charAt(0)}${publicMonitor.tone.slice(1).toLowerCase()}${publicMonitor.stale ? " · stale" : ""}${publicMonitor.responseTimeMs !== null ? ` · ${publicMonitor.responseTimeMs} ms` : ""}`,
      href: "/admin/settings",
      tone: publicMonitor.tone === "ONLINE" ? "healthy" : ["OFFLINE", "DEGRADED"].includes(publicMonitor.tone) ? "attention" : "unknown",
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      <section className="border-b border-white/[0.08] pb-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-[var(--helios-orange)]">
              {longDate(dashboard.generatedAt)}
            </p>
            <h1 className="mt-3 text-3xl font-light tracking-[-0.035em] text-white sm:text-4xl">
              Good {mountainHour < 12
                ? "morning"
                : mountainHour < 17
                  ? "afternoon"
                  : "evening"}
              , {session.displayName.split(" ")[0]}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
              A verified view of what needs attention, what is scheduled, and
              how Helios Studio is operating.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canOperate ? (
              <>
                <Link href="/admin/inquiries" className="admin-btn-secondary">
                  Review inquiries
                </Link>
                <Link href="/admin/projects/new" className="admin-btn-primary">
                  Create project
                </Link>
              </>
            ) : null}
            <DashboardRefresh />
          </div>
        </div>
        <p className="mt-4 text-[0.65rem] text-white/25">
          Last refreshed {date(dashboard.generatedAt, true)} · Mountain Time
        </p>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.045] p-5 sm:p-6">
        <div className="absolute inset-y-0 left-0 w-px bg-[var(--helios-orange)]" />
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[var(--helios-orange)]">
          Studio Briefing
        </p>
        <p className="mt-3 max-w-4xl text-base font-light leading-7 text-white/75 sm:text-lg">
          {briefing}
        </p>
        <p className="mt-3 text-[0.65rem] text-white/25">
          Generated deterministically from the verified records below.
        </p>
      </section>

      {operations.data.attention.length ? (
        <section aria-labelledby="attention-title">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[var(--helios-orange)]">
                Priority
              </p>
              <h2 id="attention-title" className="mt-2 text-2xl font-light text-white">
                Attention required
              </h2>
            </div>
            <span className="rounded-full border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/[0.08] px-3 py-1 text-xs text-[var(--helios-orange)]">
              {operations.data.attention.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {operations.data.attention.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex min-w-0 items-start gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-white/15 hover:bg-white/[0.04]"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    item.severity === "critical"
                      ? "bg-red-400"
                      : item.severity === "attention"
                        ? "bg-[var(--helios-orange)]"
                        : "bg-white/35"
                  }`}
                  aria-label={`${item.severity} severity`}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/30">
                    {item.type} · {date(item.date, true)}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-white/70">
                    {item.message}
                  </span>
                </span>
                <span className="shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white/30 transition group-hover:text-[var(--helios-orange)]">
                  {item.action}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.035] px-5 py-4">
          <p className="text-sm text-emerald-200/70">
            No verified items currently require immediate attention.
          </p>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <SectionHeading eyebrow="Schedule" title="Today & upcoming" />
          {!operations.available ? (
            <div className="mt-5"><SectionError /></div>
          ) : operations.data.upcoming.length ? (
            <div className="mt-5 divide-y divide-white/[0.07]">
              {operations.data.upcoming.slice(0, 9).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <span className="text-xs text-white/30">{date(item.date)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/70">{item.title}</span>
                    <span className="mt-1 block text-[0.62rem] uppercase tracking-[0.14em] text-white/25">
                      {item.type}
                    </span>
                  </span>
                  <span className="text-[0.58rem] font-semibold uppercase tracking-[0.13em] text-white/30 group-hover:text-[var(--helios-orange)]">
                    {item.state}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-white/[0.07] px-4 py-6 text-sm text-white/35">
              No scheduled Studio work in the next 14 days.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <SectionHeading eyebrow="Systems" title="Operational status" />
          <div className="mt-5 divide-y divide-white/[0.07]">
            {statusItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-white/60">{item.label}</span>
                <span className="flex items-center gap-2 text-right text-xs text-white/35">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      item.tone === "healthy"
                        ? "bg-emerald-400"
                        : item.tone === "attention"
                          ? "bg-[var(--helios-orange)]"
                          : "bg-white/25"
                    }`}
                    aria-hidden="true"
                  />
                  {item.status}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-5 border-t border-white/[0.07] pt-4 text-[0.65rem] leading-5 text-white/25">
            “Healthy” is shown only for a confirmed state or recent processing
            record. Public uptime is not monitored by Helios Studio.
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Performance"
            title="Communication health"
            href="/admin/email-studio"
            action="Open Email Studio"
          />
          <nav aria-label="Communication date range" className="flex rounded-full border border-white/[0.08] p-1">
            {[7, 30, 90].map((range) => (
              <Link
                key={range}
                href={`/admin?range=${range}`}
                className={`rounded-full px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${
                  days === range
                    ? "bg-white/10 text-white"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                {range} days
              </Link>
            ))}
          </nav>
        </div>
        {!communications.available ? (
          <div className="mt-5"><SectionError /></div>
        ) : communications.data.campaigns ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              <Metric label="Campaigns sent" value={communications.data.campaigns} />
              <Metric label="Intended recipients" value={communications.data.metrics.intended} />
              <Metric label="Delivered" value={communications.data.metrics.delivered} />
              <Metric label="Delivery rate" value={`${communications.data.metrics.deliveryRate.toFixed(1)}%`} />
              <Metric label="Unique clicks" value={communications.data.metrics.uniqueClicks} />
              <Metric label="Click rate" value={`${communications.data.metrics.clickThroughRate.toFixed(1)}%`} />
              <Metric label="Unsubscribes" value={communications.data.metrics.unsubscribes} />
              <Metric label="Bounces" value={communications.data.metrics.bounces} />
              <Metric label="Complaints" value={communications.data.metrics.complaints} />
              <Metric label="Failed" value={communications.data.metrics.failed} />
              <Metric label="Estimated opens" value={communications.data.metrics.estimatedOpens} secondary detail="Privacy controls and scanners affect accuracy." />
              <Metric label="Estimated open rate" value={`${communications.data.metrics.estimatedOpenRate.toFixed(1)}%`} secondary />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/[0.07] p-4">
                <p className="text-[0.58rem] uppercase tracking-[0.17em] text-white/30">Period comparison</p>
                <p className="mt-2 text-sm text-white/60">
                  {communications.data.priorDeliveryRate === null
                    ? "Previous-period data is not available."
                    : `${communications.data.metrics.deliveryRate >= communications.data.priorDeliveryRate ? "Up" : "Down"} ${Math.abs(communications.data.metrics.deliveryRate - communications.data.priorDeliveryRate).toFixed(1)} points from the prior period.`}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] p-4">
                <p className="text-[0.58rem] uppercase tracking-[0.17em] text-white/30">Best recent campaign</p>
                {communications.data.bestCampaign ? (
                  <Link
                    href={communications.data.bestCampaign.newsletterEditionId ? `/admin/newsletter-studio/editions/${communications.data.bestCampaign.newsletterEditionId}` : `/admin/email-studio?campaign=${communications.data.bestCampaign.id}`}
                    className="mt-2 block truncate text-sm text-white/60 hover:text-white"
                  >
                    {communications.data.bestCampaign.subject} · {communications.data.bestCampaign.clicks} clicks
                  </Link>
                ) : <p className="mt-2 text-sm text-white/35">No comparable campaign.</p>}
              </div>
              <div className="rounded-xl border border-white/[0.07] p-4">
                <p className="text-[0.58rem] uppercase tracking-[0.17em] text-white/30">Top clicked link</p>
                <p className="mt-2 truncate text-sm text-white/60">
                  {communications.data.metrics.topLink
                    ? `${communications.data.metrics.topLink[0]} · ${communications.data.metrics.topLink[1]}`
                    : "No tracked clicks in this period."}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-xl border border-white/[0.07] px-4 py-6 text-sm text-white/35">
            No communications were sent during this period.
          </p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <SectionHeading eyebrow="Production" title="Content engine" href="/admin/blog" action="Open Blog Studio" />
          {!content.available ? <div className="mt-5"><SectionError /></div> : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label={`Blogs published · ${days}d`} value={content.data.publishedBlogs} />
                <Metric label="Blog drafts" value={content.data.blogDrafts} />
                <Metric label="Active blog series" value={content.data.activeBlogSeries} />
                <Metric label="Active newsletters" value={content.data.activeNewsletterSeries} />
                <Metric label="Social drafts" value={content.data.socialDraftCampaigns} />
                <Metric label="Social planned" value={content.data.socialPlanned} />
                <Metric label="Social published · month" value={content.data.socialPublishedThisMonth} />
              </div>
              <p className="mt-4 text-sm leading-6 text-white/45">
                {content.data.blogDrafts + content.data.newsletterReviews
                  ? `${content.data.blogDrafts + content.data.newsletterReviews} content ${content.data.blogDrafts + content.data.newsletterReviews === 1 ? "item requires" : "items require"} review.`
                  : "Content cadence has no verified review backlog."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/admin/blog" className="admin-btn-secondary">Manage blog</Link>
                <Link href="/admin/newsletter-studio" className="admin-btn-secondary">Manage newsletter</Link>
                <Link href="/admin/social-studio" className="admin-btn-secondary">Social Studio</Link>
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <SectionHeading eyebrow="Relationships" title="Clients & referrals" href="/admin/clients" action="Open clients" />
          {!relationships.available ? <div className="mt-5"><SectionError /></div> : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Active clients" value={relationships.data.clients} />
                <Metric label="Email eligible" value={relationships.data.eligibleClients} />
                <Metric label="Client groups" value={relationships.data.groups} />
                <Metric label="Active referrals" value={relationships.data.activeReferrals} />
                <Metric label="Included advocates" value={relationships.data.advocates} />
                <Metric label="Qualified referrals" value={relationships.data.qualifiedReferrals} />
              </div>
              <p className="mt-4 text-[0.68rem] leading-5 text-white/28">
                Last confirmed client sync: {relationships.data.lastSync ? date(relationships.data.lastSync, true) : "not available"}. Referral outcomes reflect recorded statuses only.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/admin/clients" className="admin-btn-secondary">Clients</Link>
                <Link href="/admin/referral-studio" className="admin-btn-secondary">Referral Studio</Link>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <SectionHeading eyebrow="Website" title="Portfolio & inquiries" href="/admin/projects" action="All projects" />
          {!website.available ? <div className="mt-5"><SectionError /></div> : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Projects" value={website.data.totalProjects} />
                <Metric label="Published" value={website.data.publishedProjects} />
                <Metric label="Drafts" value={website.data.draftProjects} />
                <Metric label="New inquiries" value={website.data.unansweredInquiries} />
              </div>
              <div className="mt-5 divide-y divide-white/[0.07] border-t border-white/[0.07]">
                {website.data.recentProjects.map((project) => (
                  <Link key={project.id} href={`/admin/projects/${project.id}`} className="flex items-center justify-between gap-4 py-4">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white/65">{project.title}</span>
                      <span className="mt-1 block text-xs text-white/25">{[project.city, project.state].filter(Boolean).join(", ") || "Location not specified"}</span>
                    </span>
                    <span className="text-[0.58rem] uppercase tracking-[0.14em] text-white/30">{project.status}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <SectionHeading eyebrow="Activity" title="Recent in Studio" href="/admin/activity" action="Audit log" />
          {!activity.available ? <div className="mt-5"><SectionError /></div> : activity.data.length ? (
            <div className="mt-5 divide-y divide-white/[0.07]">
              {activity.data.map((item) => (
                <Link key={item.id} href={item.href} className="block py-3.5 first:pt-0 last:pb-0">
                  <p className="line-clamp-2 text-sm leading-5 text-white/60">{item.summary}</p>
                  <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.13em] text-white/25">
                    {item.action.replaceAll("_", " ")} · {date(item.createdAt, true)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-white/35">No recent Studio activity is available.</p>
          )}
        </section>
      </div>
    </div>
  );
}
