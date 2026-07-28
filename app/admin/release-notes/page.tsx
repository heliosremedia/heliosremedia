import Link from "next/link";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { STUDIO_RELEASES } from "@/lib/releases";

export default function ReleaseNotesPage() {
  return <AdminPageLayout
    header={<AdminPageHeader
      eyebrow="Administration"
      title="Release Notes"
      description="A code-controlled record of confirmed Helios Studio releases, deployment status, and administrator actions."
      note="Release history cannot be edited in Studio Admin."
    />}
  >
    <section className="grid gap-4">
      {STUDIO_RELEASES.map(release => <Link
        key={release.slug}
        href={`/admin/release-notes/${release.slug}`}
        className="group rounded-2xl border border-white/[0.08] bg-[#111] p-6 transition hover:border-[var(--helios-orange)]/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow text-[var(--helios-orange)]">{release.version}</p>
          <span className="rounded-full border border-emerald-300/20 px-3 py-1 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-emerald-200">{release.status}</span>
        </div>
        <h2 className="mt-4 text-2xl font-light text-white group-hover:text-[var(--helios-orange)]">{release.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">{release.summary}</p>
        <p className="mt-4 text-xs text-white/25">{release.releaseDate ? new Date(`${release.releaseDate}T12:00:00`).toLocaleDateString() : "Release date pending"}</p>
      </Link>)}
    </section>
  </AdminPageLayout>;
}
