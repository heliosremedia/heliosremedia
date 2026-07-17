import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ProjectsPageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
};

const statusOptions = [
  { label: "All projects", value: "ALL" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Archived", value: "ARCHIVED" },
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusClasses(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300";

    case "ARCHIVED":
      return "border-white/10 bg-white/[0.04] text-white/45";

    default:
      return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";
  }
}

function buildFilterUrl(status: string, search: string) {
  const params = new URLSearchParams();

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (search) {
    params.set("search", search);
  }

  const query = params.toString();

  return query ? `/admin/projects?${query}` : "/admin/projects";
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

  const projects = await prisma.project.findMany({
    where: {
      ...(activeStatus !== "ALL"
        ? {
            status: activeStatus as
              | "DRAFT"
              | "PUBLISHED"
              | "ARCHIVED",
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                city: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                state: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                locationLabel: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                slug: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },

    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        title: "asc",
      },
    ],

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

      media: {
        where: {
          visibility: "VISIBLE",
        },

        select: {
          id: true,
        },
      },
    },
  });

  const hasFilters = Boolean(search || activeStatus !== "ALL");

  return (
    <div className="space-y-7">
      <section className="border-b border-white/[0.08] pb-7">
        <p className="eyebrow text-[var(--helios-orange)]">
          Portfolio
        </p>

        <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
          Projects
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
          Create, organize, and publish the work displayed across the
          Helios portfolio.
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <form className="flex w-full max-w-xl items-center rounded-xl border border-white/[0.08] bg-black/20 px-4 transition focus-within:border-white/20">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4 shrink-0 text-white/30"
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
              placeholder="Search projects or locations"
              className="h-11 w-full border-0 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/25"
            />

            {activeStatus !== "ALL" ? (
              <input
                type="hidden"
                name="status"
                value={activeStatus}
              />
            ) : null}

            <button
              type="submit"
              className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40 transition hover:text-white"
            >
              Search
            </button>
          </form>

          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {statusOptions.map((option) => {
              const active = activeStatus === option.value;

              return (
                <Link
                  key={option.value}
                  href={buildFilterUrl(option.value, search)}
                  className={`inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border px-4 text-[0.6rem] font-semibold uppercase tracking-[0.15em] transition ${
                    active
                      ? "border-[var(--helios-orange)]/40 bg-[var(--helios-orange)]/10 text-[var(--helios-orange-hover)]"
                      : "border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-2xl font-normal text-white">
              Portfolio projects
            </h2>

            <p className="mt-1 text-sm text-white/35">
              {projects.length}{" "}
              {projects.length === 1 ? "project" : "projects"}
              {hasFilters ? " matching your filters" : ""}
            </p>
          </div>

          {hasFilters ? (
            <Link
              href="/admin/projects"
              className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40 transition hover:text-white"
            >
              Clear filters
            </Link>
          ) : null}
        </div>

        {projects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="px-6 py-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Project
                  </th>

                  <th className="px-5 py-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Location
                  </th>

                  <th className="px-5 py-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Media
                  </th>

                  <th className="px-5 py-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Status
                  </th>

                  <th className="px-5 py-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Updated
                  </th>

                  <th className="px-6 py-4 text-right text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {projects.map((project) => {
                  const location =
                    project.locationLabel ||
                    [project.city, project.state]
                      .filter(Boolean)
                      .join(", ");

                  return (
                    <tr
                      key={project.id}
                      className="group border-b border-white/[0.06] transition last:border-b-0 hover:bg-white/[0.018]"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-white/20">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="h-5 w-5"
                            >
                              <rect
                                x="4"
                                y="4"
                                width="16"
                                height="16"
                                rx="2"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />

                              <path
                                d="m6 17 4-4 2.5 2.5 2-2L18 17"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-white">
                                {project.title}
                              </p>

                              {project.featured ? (
                                <span className="rounded-full border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.08] px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.12em] text-[var(--helios-orange-hover)]">
                                  Featured
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 truncate text-xs text-white/30">
                              /{project.slug}
                            </p>

                            {project.shortDescription ? (
                              <p className="mt-1 max-w-md truncate text-xs text-white/35">
                                {project.shortDescription}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5 text-sm text-white/50">
                        {location || "Not specified"}
                      </td>

                      <td className="px-5 py-5">
                        <span className="text-sm text-white/50">
                          {project.media.length}
                        </span>
                      </td>

                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] ${statusClasses(
                            project.status,
                          )}`}
                        >
                          {formatStatus(project.status)}
                        </span>
                      </td>

                      <td className="px-5 py-5 text-sm text-white/40">
                        {formatDate(project.updatedAt)}
                      </td>

                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/admin/projects/${project.id}`}
                          className="inline-flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white/45 transition group-hover:text-[var(--helios-orange)]"
                        >
                          Edit

                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-3.5 w-3.5"
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[26rem] flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/35">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
              >
                {hasFilters ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <path
                      d="M4 7.5h16M7 4h10a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M12 10v6M9 13h6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </>
                )}
              </svg>
            </div>

            <h3 className="mt-5 text-2xl font-normal text-white">
              {hasFilters
                ? "No projects match your search."
                : "No projects yet."}
            </h3>

            <p className="mt-3 max-w-md text-sm leading-6 text-white/40">
              {hasFilters
                ? "Try changing your search or clearing the current filters."
                : "Create your first project and begin building the dynamic Helios portfolio."}
            </p>

            {hasFilters ? (
              <Link
                href="/admin/projects"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-6 text-[0.66rem] font-semibold uppercase tracking-[0.17em] text-white/55 transition hover:border-white/25 hover:text-white"
              >
                Clear filters
              </Link>
            ) : (
              <Link
                href="/admin/projects/new"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--helios-orange)] px-6 text-[0.66rem] font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[var(--helios-orange-hover)]"
              >
                Create first project
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}