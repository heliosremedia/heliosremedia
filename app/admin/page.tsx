import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export default async function AdminPage() {
  const [
    totalProjects,
    draftProjects,
    publishedProjects,
    recentProjects,
    newInquiries,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({
      where: {
        status: "DRAFT",
      },
    }),
    prisma.project.count({
      where: {
        status: "PUBLISHED",
      },
    }),
    prisma.project.findMany({
      take: 8,
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        city: true,
        state: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.inquiry.count({ where: { status: "NEW" } }),
  ]);

  const statistics = [
    {
      label: "Total projects",
      value: totalProjects,
      detail: "All portfolio entries",
    },
    {
      label: "Published",
      value: publishedProjects,
      detail: "Live on the website",
    },
    {
      label: "Drafts",
      value: draftProjects,
      detail: "Waiting for completion",
    },
    {
      label: "New inquiries",
      value: newInquiries,
      detail: "Waiting for follow-up",
    },
  ];

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">
            Dashboard
          </p>

          <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
            Portfolio overview
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Manage projects, organize media, and control what appears
            across the Helios portfolio.
          </p>
        </div>

        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
        >
          View all projects

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
        {statistics.map((stat) => (
          <article
            key={stat.label}
            className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-white/35">
              {stat.label}
            </p>

            <div className="mt-5 flex items-end justify-between gap-4">
              <p className="font-display text-4xl font-light leading-none text-white">
                {stat.value}
              </p>

              <p className="max-w-28 text-right text-[0.68rem] leading-5 text-white/30">
                {stat.detail}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-2xl font-normal text-white">
              Recent projects
            </h2>

            <p className="mt-1 text-sm text-white/35">
              Your most recently updated portfolio entries.
            </p>
          </div>

          <Link
            href="/admin/projects/new"
            className="hidden rounded-full border border-white/10 px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/55 transition hover:border-white/25 hover:text-white sm:inline-flex"
          >
            Add project
          </Link>
        </div>

        {recentProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="px-6 py-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Project
                  </th>
                  <th className="px-5 py-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Location
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
                {recentProjects.map((project) => {
                  const location = [project.city, project.state]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <tr
                      key={project.id}
                      className="border-b border-white/[0.06] transition last:border-b-0 hover:bg-white/[0.018]"
                    >
                      <td className="px-6 py-5">
                        <p className="font-medium text-white">
                          {project.title}
                        </p>

                        <p className="mt-1 text-xs text-white/30">
                          /{project.slug}
                        </p>
                      </td>

                      <td className="px-5 py-5 text-sm text-white/50">
                        {location || "Not specified"}
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
                          className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white/45 transition hover:text-[var(--helios-orange)]"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/35">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
              >
                <path
                  d="M4 7.5h16M7 4h10a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>

            <h3 className="mt-5 text-2xl font-normal text-white">
              Your portfolio starts here.
            </h3>

            <p className="mt-3 max-w-md text-sm leading-6 text-white/40">
              Create your first project and begin building the dynamic
              Helios portfolio.
            </p>

            <Link
              href="/admin/projects/new"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--helios-orange)] px-6 text-[0.66rem] font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[var(--helios-orange-hover)]"
            >
              Create first project
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
