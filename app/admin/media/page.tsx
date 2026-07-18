import Link from "next/link";

import type { Prisma } from "@/app/generated/prisma/client";
import {
  MEDIA_COLLECTIONS,
  getMediaCollection,
  isMediaCategory,
  type MediaCategory,
} from "@/lib/media-collections";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";

import MediaLibraryGrid, { type LibraryMediaItem } from "./MediaLibraryGrid";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 36;

type MediaLibraryPageProps = {
  searchParams: Promise<{
    search?: string | string[];
    category?: string | string[];
    visibility?: string | string[];
    project?: string | string[];
    page?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getPage(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type FilterValues = {
  search: string;
  category: MediaCategory | "ALL";
  visibility: "VISIBLE" | "HIDDEN" | "ALL";
  projectId: string;
};

function buildLibraryUrl(
  filters: FilterValues,
  overrides: Partial<FilterValues> & { page?: number } = {},
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.search) {
    params.set("search", next.search);
  }

  if (next.category !== "ALL") {
    params.set("category", next.category);
  }

  if (next.visibility !== "ALL") {
    params.set("visibility", next.visibility);
  }

  if (next.projectId) {
    params.set("project", next.projectId);
  }

  if (overrides.page && overrides.page > 1) {
    params.set("page", String(overrides.page));
  }

  const query = params.toString();
  return query ? `/admin/media?${query}` : "/admin/media";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function MediaLibraryPage({
  searchParams,
}: MediaLibraryPageProps) {
  const params = await searchParams;
  const search = getParam(params.search);
  const requestedCategory = getParam(params.category).toUpperCase();
  const category = isMediaCategory(requestedCategory)
    ? requestedCategory
    : "ALL";
  const requestedVisibility = getParam(params.visibility).toUpperCase();
  const visibility =
    requestedVisibility === "VISIBLE" || requestedVisibility === "HIDDEN"
      ? requestedVisibility
      : "ALL";
  const projectId = getParam(params.project);
  const requestedPage = getPage(getParam(params.page));
  const filters: FilterValues = {
    search,
    category,
    visibility,
    projectId,
  };

  const where: Prisma.MediaWhereInput = {
    ...(category !== "ALL" ? { mediaCategory: category } : {}),
    ...(visibility !== "ALL" ? { visibility } : {}),
    ...(projectId ? { projectId } : {}),
    ...(search
      ? {
          OR: [
            {
              originalFilename: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              altText: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              caption: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              project: {
                is: {
                  OR: [
                    {
                      title: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      slug: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      locationLabel: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const [totalAssets, visibleAssets, hiddenAssets, projectCount, resultCount] =
    await Promise.all([
      prisma.media.count(),
      prisma.media.count({ where: { visibility: "VISIBLE" } }),
      prisma.media.count({ where: { visibility: "HIDDEN" } }),
      prisma.project.count({ where: { media: { some: {} } } }),
      prisma.media.count({ where }),
    ]);
  const totalPages = Math.max(1, Math.ceil(resultCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const media = await prisma.media.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      originalFilename: true,
      altText: true,
      caption: true,
      mimeType: true,
      fileSize: true,
      width: true,
      height: true,
      mediaCategory: true,
      visibility: true,
      storageKey: true,
      externalUrl: true,
      createdAt: true,
      heroForProject: {
        select: {
          id: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
        },
      },
    },
  });
  const activeProject = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, title: true },
      })
    : null;
  const items: LibraryMediaItem[] = media.map((item) => ({
    id: item.id,
    originalFilename: item.originalFilename,
    altText: item.altText,
    caption: item.caption,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    width: item.width,
    height: item.height,
    mediaCategory: item.mediaCategory,
    collectionLabel: getMediaCollection(item.mediaCategory).label,
    visibility: item.visibility,
    createdAt: item.createdAt.toISOString(),
    publicUrl: item.storageKey ? getPublicAssetUrl(item.storageKey) : null,
    externalUrl: item.externalUrl,
    isHero: Boolean(item.heroForProject),
    projectFilterUrl: buildLibraryUrl(filters, {
      projectId: item.project.id,
    }),
    project: item.project,
  }));
  const hasFilters = Boolean(
    search || category !== "ALL" || visibility !== "ALL" || projectId,
  );
  const firstResult = resultCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastResult = Math.min(page * PAGE_SIZE, resultCount);

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">Digital assets</p>
          <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
            Media library
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Search, inspect, and trace every project asset from one global DAM
            workspace.
          </p>
        </div>

        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40 transition hover:text-white"
        >
          Upload through a project
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="m9 6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total assets",
            value: totalAssets,
            detail: "Across the DAM",
          },
          { label: "Visible", value: visibleAssets, detail: "Portfolio ready" },
          { label: "Hidden", value: hiddenAssets, detail: "Internal only" },
          { label: "Projects", value: projectCount, detail: "With media" },
        ].map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
          >
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/30">
              {stat.label}
            </p>
            <div className="mt-5 flex items-end justify-between gap-4">
              <p className="font-display text-4xl font-light leading-none text-white">
                {formatNumber(stat.value)}
              </p>
              <p className="text-right text-[0.65rem] text-white/25">
                {stat.detail}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="p-4 sm:p-5">
          <form className="flex flex-col gap-3 sm:flex-row">
            {category !== "ALL" && (
              <input type="hidden" name="category" value={category} />
            )}
            {visibility !== "ALL" && (
              <input type="hidden" name="visibility" value={visibility} />
            )}
            {projectId && (
              <input type="hidden" name="project" value={projectId} />
            )}

            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-4 transition focus-within:border-white/20">
              <span className="sr-only">Search media library</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4 shrink-0 text-white/25"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="m16 16 4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Search filename, metadata, project, or location"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20"
              />
            </label>

            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--helios-orange)] px-7 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-[var(--helios-orange-hover)]"
            >
              Search assets
            </button>

            {hasFilters && (
              <Link
                href="/admin/media"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/40 transition hover:border-white/25 hover:text-white"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        <div className="border-t border-white/[0.07] px-4 py-4 sm:px-5">
          <p className="mb-3 text-[0.52rem] font-semibold uppercase tracking-[0.17em] text-white/20">
            Collection
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Link
              href={buildLibraryUrl(filters, { category: "ALL" })}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-[0.52rem] font-semibold uppercase tracking-[0.13em] transition ${
                category === "ALL"
                  ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
                  : "border-white/10 text-white/35 hover:border-white/25 hover:text-white"
              }`}
            >
              All collections
            </Link>
            {MEDIA_COLLECTIONS.map((collection) => (
              <Link
                key={collection.value}
                href={buildLibraryUrl(filters, { category: collection.value })}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-[0.52rem] font-semibold uppercase tracking-[0.13em] transition ${
                  category === collection.value
                    ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
                    : "border-white/10 text-white/35 hover:border-white/25 hover:text-white"
                }`}
              >
                {collection.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", "VISIBLE", "HIDDEN"] as const).map((option) => (
              <Link
                key={option}
                href={buildLibraryUrl(filters, { visibility: option })}
                className={`rounded-full border px-3.5 py-2 text-[0.52rem] font-semibold uppercase tracking-[0.13em] transition ${
                  visibility === option
                    ? "border-white/25 bg-white/[0.08] text-white"
                    : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/65"
                }`}
              >
                {option === "ALL" ? "All visibility" : option.toLowerCase()}
              </Link>
            ))}

            {activeProject && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/[0.07] px-3.5 py-2 text-[0.52rem] font-semibold uppercase tracking-[0.13em] text-[var(--helios-orange-hover)]">
                {activeProject.title}
                <Link
                  href={buildLibraryUrl(filters, { projectId: "" })}
                  aria-label={`Remove ${activeProject.title} filter`}
                  className="text-current opacity-60 transition hover:opacity-100"
                >
                  ×
                </Link>
              </span>
            )}
          </div>

          <p className="text-xs text-white/25">
            {formatNumber(firstResult)}–{formatNumber(lastResult)} of{" "}
            {formatNumber(resultCount)}
          </p>
        </div>
      </section>

      {items.length > 0 ? (
        <MediaLibraryGrid items={items} />
      ) : (
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-light text-white">
            No assets match these filters.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/35">
            Adjust the collection, visibility, or search terms to broaden the
            library view.
          </p>
          <Link
            href="/admin/media"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/55 transition hover:border-white/30 hover:text-white"
          >
            View all assets
          </Link>
        </section>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Media library pages"
          className="flex items-center justify-between gap-4 border-t border-white/[0.08] pt-6"
        >
          {page > 1 ? (
            <Link
              href={buildLibraryUrl(filters, { page: page - 1 })}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-5 text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-white/45 transition hover:border-white/25 hover:text-white"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}

          <p className="text-xs text-white/30">
            Page {page} of {totalPages}
          </p>

          {page < totalPages ? (
            <Link
              href={buildLibraryUrl(filters, { page: page + 1 })}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-5 text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-white/45 transition hover:border-white/25 hover:text-white"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
