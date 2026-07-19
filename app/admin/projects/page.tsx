import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import ProjectListManager from "./ProjectListManager";

export const dynamic = "force-dynamic";
type ProjectsPageProps = { searchParams: Promise<{ search?: string; status?: string }> };
const statusOptions = [{ label: "All projects", value: "ALL" }, { label: "Drafts", value: "DRAFT" }, { label: "Published", value: "PUBLISHED" }, { label: "Archived", value: "ARCHIVED" }];
function buildFilterUrl(status: string, search: string) { const params = new URLSearchParams(); if (status !== "ALL") params.set("status", status); if (search) params.set("search", search); return params.size ? `/admin/projects?${params}` : "/admin/projects"; }
function formatDate(date: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const requestedStatus = params.status?.toUpperCase() ?? "ALL";
  const activeStatus = statusOptions.some((option) => option.value === requestedStatus) ? requestedStatus : "ALL";
  const projects = await prisma.project.findMany({
    where: {
      ...(activeStatus !== "ALL" ? { status: activeStatus as "DRAFT" | "PUBLISHED" | "ARCHIVED" } : {}),
      ...(search ? { OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { city: { contains: search, mode: "insensitive" as const } },
        { state: { contains: search, mode: "insensitive" as const } },
        { locationLabel: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
      ] } : {}),
    },
    orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }, { title: "asc" }],
    select: {
      id: true, title: true, slug: true, shortDescription: true, city: true, state: true, locationLabel: true, status: true, featured: true, updatedAt: true,
      thumbnailMedia: { select: { storageKey: true, altText: true, originalFilename: true } },
      heroMedia: { select: { storageKey: true, altText: true, originalFilename: true } },
      media: { where: { visibility: "VISIBLE" }, select: { id: true } },
    },
  });
  const hasFilters = Boolean(search || activeStatus !== "ALL");
  const items = projects.map((project) => {
    const image = project.thumbnailMedia?.storageKey ? project.thumbnailMedia : project.heroMedia;
    return {
      id: project.id, title: project.title, slug: project.slug, shortDescription: project.shortDescription,
      location: project.locationLabel || [project.city, project.state].filter(Boolean).join(", ") || "—",
      status: project.status, featured: project.featured, updatedAt: formatDate(project.updatedAt), mediaCount: project.media.length,
      thumbnailUrl: image?.storageKey ? getPublicAssetUrl(image.storageKey) : null,
      thumbnailAlt: image?.altText || image?.originalFilename || project.title,
    };
  });

  return <div className="space-y-7">
    <section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Portfolio</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Projects</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Create, organize, publish, and arrange the work displayed across the Helios portfolio.</p></section>
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <form className="flex w-full max-w-xl items-center rounded-xl border border-white/[0.08] bg-black/20 px-4 focus-within:border-white/20"><span className="text-white/30">⌕</span><input type="search" name="search" defaultValue={search} placeholder="Search projects or locations" className="h-11 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/25" />{activeStatus !== "ALL" ? <input type="hidden" name="status" value={activeStatus} /> : null}<button type="submit" className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40 hover:text-white">Search</button></form>
      <div className="flex gap-2 overflow-x-auto pb-1">{statusOptions.map((option) => <Link key={option.value} href={buildFilterUrl(option.value, search)} className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-4 text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${activeStatus === option.value ? "border-[var(--helios-orange)]/40 bg-[var(--helios-orange)]/10 text-[var(--helios-orange-hover)]" : "border-white/[0.08] text-white/40 hover:text-white"}`}>{option.label}</Link>)}</div>
    </div></section>
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">{hasFilters ? <div className="border-b border-white/[0.08] px-6 py-3 text-right"><Link href="/admin/projects" className="text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/40 hover:text-white">Clear filters</Link></div> : null}<ProjectListManager initialProjects={items} hasFilters={hasFilters} /></section>
  </div>;
}
