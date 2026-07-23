import Link from "next/link";

import { tryResolveExternalMedia } from "@/lib/external-media";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";

import ProjectListManager from "./ProjectListManager";

export const dynamic = "force-dynamic";

type ProjectsPageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const statusOptions = [
  { label: "All projects", value: "ALL" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Archived", value: "ARCHIVED" },
];

function buildProjectsUrl({
  status,
  search,
  page,
  pageSize,
}: {
  status: string;
  search: string;
  page?: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();

  if (status !== "ALL") params.set("status", status);
  if (search) params.set("search", search);
  if (page && page > 1) params.set("page", String(page));
  if (pageSize !== 30) params.set("pageSize", String(pageSize));

  return params.size ? `/admin/projects?${params}` : "/admin/projects";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const requestedStatus = params.status?.toUpperCase() ?? "ALL";
  const activeStatus = statusOptions.some(
    (option) => option.value === requestedStatus,
  )
    ? requestedStatus
    : "ALL";
  const pageSize = params.pageSize === "60" ? 60 : 30;
  const requestedPage = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1,
  );
  const where = {
    ...(activeStatus !== "ALL"
      ? {
          status: activeStatus as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
            { state: { contains: search, mode: "insensitive" as const } },
            {
              locationLabel: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              details: {
                is: {
                  propertyAddress: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const totalProjects = await prisma.project.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalProjects / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const projects = await prisma.project.findMany({
    where,
    orderBy: [
      { displayOrder: "asc" },
      { updatedAt: "desc" },
      { title: "asc" },
    ],
    skip: pageStart,
    take: pageSize,
    select: {
      id: true,
      title: true,
      slug: true,
      shortDescription: true,
      city: true,
      state: true,
      locationLabel: true,
      status: true,
      featured: true,
      updatedAt: true,
      thumbnailMedia: {
        select: {
          storageKey: true,
          altText: true,
          originalFilename: true,
        },
      },
      heroMedia: {
        select: {
          storageKey: true,
          altText: true,
          originalFilename: true,
        },
      },
      media: {
        where: {
          visibility: "VISIBLE",
          sourceType: { in: ["VIDEO_EMBED", "UPLOADED_VIDEO"] },
          externalUrl: { not: null },
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { externalUrl: true, originalFilename: true, altText: true },
      },
      _count: { select: { media: true } },
    },
  });
  const hasFilters = Boolean(search || activeStatus !== "ALL");
  const currentUrl = buildProjectsUrl({
    status: activeStatus,
    search,
    page: currentPage,
    pageSize,
  });
  const items = projects.map((project) => {
    const image = project.thumbnailMedia?.storageKey
      ? project.thumbnailMedia
      : project.heroMedia?.storageKey
        ? project.heroMedia
        : null;
    const video = tryResolveExternalMedia(project.media[0]?.externalUrl);

    return {
      id: project.id,
      title: project.title,
      slug: project.slug,
      shortDescription: project.shortDescription,
      location:
        project.locationLabel ||
        [project.city, project.state].filter(Boolean).join(", ") ||
        "—",
      status: project.status,
      featured: project.featured,
      updatedAt: formatDate(project.updatedAt),
      mediaCount: project._count.media,
      thumbnailUrl: image?.storageKey
        ? getPublicAssetUrl(image.storageKey)
        : video?.thumbnailUrl || null,
      thumbnailAlt:
        image?.altText ||
        image?.originalFilename ||
        project.media[0]?.altText ||
        project.media[0]?.originalFilename ||
        project.title,
    };
  });
  const firstShown = totalProjects === 0 ? 0 : pageStart + 1;
  const lastShown = Math.min(pageStart + items.length, totalProjects);

  return (
    <div className="space-y-7">
      <section className="border-b border-white/[0.08] pb-7">
        <p className="eyebrow text-[var(--helios-orange)]">Portfolio</p>
        <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
          Projects
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
          Create, organize, publish, and arrange the work displayed across the
          Helios portfolio.
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <form className="flex w-full max-w-xl items-center rounded-xl border border-white/[0.08] bg-black/20 px-4 focus-within:border-white/20">
            <span className="text-white/30">⌕</span>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search titles, locations, or property addresses"
              className="h-11 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/25"
            />
            {activeStatus !== "ALL" ? (
              <input type="hidden" name="status" value={activeStatus} />
            ) : null}
            {pageSize !== 30 ? (
              <input type="hidden" name="pageSize" value={pageSize} />
            ) : null}
            <button
              type="submit"
              className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40 hover:text-white"
            >
              Search
            </button>
          </form>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusOptions.map((option) => (
              <Link
                key={option.value}
                href={buildProjectsUrl({
                  status: option.value,
                  search,
                  pageSize,
                })}
                className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-4 text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${
                  activeStatus === option.value
                    ? "border-[var(--helios-orange)]/40 bg-[var(--helios-orange)]/10 text-[var(--helios-orange-hover)]"
                    : "border-white/[0.08] text-white/40 hover:text-white"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {hasFilters ? (
          <div className="border-b border-white/[0.08] px-6 py-3 text-right">
            <Link
              href={buildProjectsUrl({
                status: "ALL",
                search: "",
                pageSize,
              })}
              className="text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/40 hover:text-white"
            >
              Clear filters
            </Link>
          </div>
        ) : null}

        <ProjectListManager
          key={currentUrl}
          initialProjects={items}
          hasFilters={hasFilters}
          pageStart={pageStart}
          returnTo={currentUrl}
          rangeLabel={`Showing ${firstShown}–${lastShown} of ${totalProjects} projects`}
        />

        <div className="flex flex-col gap-5 border-t border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <form className="flex items-center gap-3">
            {activeStatus !== "ALL" ? (
              <input type="hidden" name="status" value={activeStatus} />
            ) : null}
            {search ? <input type="hidden" name="search" value={search} /> : null}
            <label
              htmlFor="project-page-size"
              className="text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/30"
            >
              Projects per page
            </label>
            <select
              id="project-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
              className="min-h-10 rounded-xl border border-white/[0.1] bg-[#111] px-3 text-sm text-white/65 outline-none focus:border-[var(--helios-orange)]/50"
            >
              <option value="30">30</option>
              <option value="60">60</option>
            </select>
            <button type="submit" className="admin-btn-secondary">
              Apply
            </button>
          </form>

          {totalPages > 1 ? (
            <nav
              aria-label="Project workspace pages"
              className="flex flex-wrap items-center gap-2"
            >
              {currentPage > 1 ? (
                <Link
                  href={buildProjectsUrl({
                    status: activeStatus,
                    search,
                    page: currentPage - 1,
                    pageSize,
                  })}
                  className="admin-btn-secondary"
                >
                  Previous
                </Link>
              ) : null}
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (page) => (
                  <Link
                    key={page}
                    href={buildProjectsUrl({
                      status: activeStatus,
                      search,
                      page,
                      pageSize,
                    })}
                    aria-current={page === currentPage ? "page" : undefined}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs transition ${
                      page === currentPage
                        ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
                        : "border-white/10 text-white/45 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {page}
                  </Link>
                ),
              )}
              {currentPage < totalPages ? (
                <Link
                  href={buildProjectsUrl({
                    status: activeStatus,
                    search,
                    page: currentPage + 1,
                    pageSize,
                  })}
                  className="admin-btn-secondary"
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}
