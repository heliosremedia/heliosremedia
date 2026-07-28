import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { getStudioRelease } from "@/lib/releases";

export default async function ReleaseNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const release = getStudioRelease((await params).slug);
  if (!release) notFound();
  const groups = [
    ["New features", release.newFeatures],
    ["Improvements", release.improvements],
    ["Bug fixes", release.bugFixes],
    ["Security & infrastructure", release.securityInfrastructure],
    ["Administrator actions", release.administratorActions],
  ] as const;
  return <AdminPageLayout header={<AdminPageHeader
    eyebrow={`${release.version} · ${release.status}`}
    title={release.title}
    description={release.summary}
    actions={<Link href="/admin/release-notes" className="admin-btn-secondary">All releases</Link>}
    note={release.releaseDate ? `Released ${new Date(`${release.releaseDate}T12:00:00`).toLocaleDateString()}` : "Release date pending"}
  />}>
    <div className="grid gap-5 lg:grid-cols-2">
      {groups.map(([title, items]) => items.length > 0 && <section key={title} className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <h2 className="text-xl font-light text-white">{title}</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-white/45">
          {items.map(item => <li key={item} className="flex gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--helios-orange)]"/><span>{item}</span></li>)}
        </ul>
      </section>)}
    </div>
  </AdminPageLayout>;
}
