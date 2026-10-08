import Link from "next/link";
import DashboardRefresh from "../components/DashboardRefresh";
import type { StudioOverview } from "@/lib/studio-overview";

const date = (value: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
const panel = "rounded-2xl border border-white/10 bg-white/[.025] p-5 sm:p-6";
const linkStyle = "text-sm text-amber-100 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-amber-200";

export default function CommandCenter({ data }: { data: StudioOverview }) {
  const { operations, website } = data;
  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-xs uppercase tracking-[.18em] text-amber-200/80">Studio V2</p><h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">Command Center</h1><p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">Know what needs you. See what’s next. Keep your work moving.</p></div>
      <Link href="/admin/projects/new" className="rounded-lg bg-amber-100 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">New project</Link>
    </div>
    <dl className="grid gap-3 sm:grid-cols-3">
      {[
        { label: "Needs attention", value: operations.available ? operations.data.attention.length : null, href: "#attention", detail: "Approvals, failures and follow-ups" },
        { label: "Upcoming work", value: operations.available ? operations.data.upcoming.length : null, href: "#upcoming", detail: "Recorded schedules in the next 14 days" },
        { label: "Projects", value: website.available ? website.data.totalProjects : null, href: "/admin/projects", detail: "All projects in this workspace" },
      ].map(item => <div key={item.label} className={panel}><dt className="text-xs text-stone-400">{item.label}</dt><dd className="mt-2 text-3xl font-light">{item.value ?? "Unavailable"}</dd><p className="mt-2 text-xs leading-5 text-stone-400">{item.detail}</p><Link href={item.href} className={`${linkStyle} mt-4 inline-block`}>View {item.label.toLowerCase()} →</Link></div>)}
    </dl>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <section id="attention" aria-labelledby="attention-heading" className={`${panel} scroll-mt-6`}>
        <h2 id="attention-heading" className="text-lg font-medium">Needs your attention</h2>
        {!operations.available ? <p role="status" className="mt-4 text-sm text-amber-100">Attention data is unavailable. Open the relevant module to review its current state.</p>
          : !operations.data.attention.length ? <p className="mt-4 text-sm text-stone-400">No attention items were returned by the connected modules.</p>
          : <ul className="mt-3 divide-y divide-white/10">{operations.data.attention.map(item => <li key={item.id} className="py-4">
            <p className={`text-[10px] uppercase tracking-[.12em] ${item.severity === "critical" ? "text-rose-300" : "text-amber-100"}`}>{item.type} · {item.severity === "critical" ? "Action required" : "Review"}</p>
            <p className="mt-2 text-sm leading-6 text-stone-200">{item.message}</p><Link href={item.href} className={`${linkStyle} mt-2 inline-block`}>{item.action} →</Link>
          </li>)}</ul>}
      </section>
      <section id="upcoming" aria-labelledby="upcoming-heading" className={`${panel} scroll-mt-6`}>
        <h2 id="upcoming-heading" className="text-lg font-medium">Coming up</h2><p className="mt-2 text-xs leading-5 text-stone-400">Next 14 days · Times shown in UTC. Open an item for its approval and delivery status.</p>
        {!operations.available ? <p role="status" className="mt-4 text-sm text-amber-100">Schedule data is unavailable. Your saved schedules have not been changed.</p>
          : !operations.data.upcoming.length ? <p className="mt-4 text-sm text-stone-400">No upcoming items were returned by the connected modules.</p>
          : <ul className="mt-3 divide-y divide-white/10">{operations.data.upcoming.map(item => <li key={item.id} className="py-4">
            <time dateTime={item.date.toISOString()} className="text-xs text-stone-400">{date(item.date)} UTC</time><p className="mt-2 text-sm font-medium"><Link className={linkStyle} href={item.href}>{item.title}</Link></p><p className="mt-2 text-xs text-stone-400">{item.type} · {item.state}</p>
          </li>)}</ul>}
      </section>
    </div>
    <section aria-labelledby="projects-heading" className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="projects-heading" className="text-lg font-medium">Recent projects</h2><Link href="/admin/projects" className={linkStyle}>All projects →</Link></div>
      {!website.available ? <p role="status" className="mt-4 text-sm text-amber-100">Project data is unavailable. Open Projects to try again.</p>
        : !website.data.recentProjects.length ? <p className="mt-4 text-sm text-stone-400">Your projects will appear here as you create them.</p>
        : <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{website.data.recentProjects.map(project => <li key={project.id} className="rounded-xl border border-white/10 p-4"><p className="text-[10px] uppercase tracking-widest text-stone-400">{project.status}</p><Link href={`/admin/projects/${project.id}`} className={`${linkStyle} mt-2 inline-block`}>{project.title}</Link><p className="mt-2 text-xs text-stone-400">{[project.city, project.state].filter(Boolean).join(", ") || "Location not set"}</p></li>)}</ul>}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-xs leading-5 text-stone-400">Snapshot {date(data.generatedAt)} UTC. This view summarizes available module records; it does not verify live provider health.</p><DashboardRefresh /></div>
  </div>;
}
