import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import ProjectMediaManager from "./ProjectMediaManager";

export const dynamic = "force-dynamic";

type ProjectEditorPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function ProjectEditorPage({
  params,
}: ProjectEditorPageProps) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDescription: true,
      city: true,
      state: true,
      locationLabel: true,
      projectType: true,
      propertyType: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          media: true,
          services: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const location =
    project.locationLabel ||
    [project.city, project.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-7">
      <section className="border-b border-white/[0.08] pb-7">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.17em] text-white/35 transition hover:text-white"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="m15 6-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          Back to projects
        </Link>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="eyebrow text-[var(--helios-orange)]">
                Project editor
              </p>

              <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-amber-200">
                {formatStatus(project.status)}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
              {project.title}
            </h1>

            <p className="mt-3 text-sm text-white/35">
              /portfolio/{project.slug}
            </p>
          </div>

          <p className="text-xs text-white/25">
            {project._count.media > 0
              ? `${project._count.media} ${
                  project._count.media === 1
                    ? "asset"
                    : "assets"
                } saved`
              : "Ready for project media"}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["01", "Details", "Complete", true],
          [
            "02",
            "Media",
            `${project._count.media} ${
              project._count.media === 1
                ? "asset"
                : "assets"
            }`,
            true,
          ],
          [
            "03",
            "Services",
            `${project._count.services} selected`,
            false,
          ],
          ["04", "Publish", "Not published", false],
        ].map(([number, label, detail, active]) => (
          <article
            key={number as string}
            className={`rounded-2xl border p-5 ${
              active
                ? "border-[var(--helios-orange)]/30 bg-[var(--helios-orange)]/[0.06]"
                : "border-white/[0.08] bg-white/[0.02]"
            }`}
          >
            <p
              className={`text-[0.6rem] font-semibold uppercase tracking-[0.18em] ${
                active
                  ? "text-[var(--helios-orange-hover)]"
                  : "text-white/25"
              }`}
            >
              Step {number}
            </p>

            <h2 className="mt-3 text-xl font-normal text-white">
              {label}
            </h2>

            <p className="mt-2 text-xs text-white/30">
              {detail}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
            <h2 className="text-2xl font-normal text-white">
              Project details
            </h2>

            <p className="mt-1 text-sm text-white/35">
              The initial information saved for this project.
            </p>
          </div>

          <dl className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
            {[
              ["Title", project.title],
              ["Location", location || "Not specified"],
              [
                "Project type",
                project.projectType || "Not specified",
              ],
              [
                "Property type",
                project.propertyType || "Not specified",
              ],
              [
                "Description",
                project.shortDescription || "Not provided",
              ],
              ["Status", formatStatus(project.status)],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="bg-[#0c0c0d] px-5 py-5 sm:px-6"
              >
                <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/25">
                  {label}
                </dt>

                <dd className="mt-2 text-sm leading-6 text-white/65">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 xl:self-start">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
            Media status
          </p>

          <h2 className="mt-3 text-2xl font-normal text-white">
            {project._count.media > 0
              ? "Media connected"
              : "Add project media"}
          </h2>

          <p className="mt-3 text-sm leading-6 text-white/40">
            {project._count.media > 0
              ? `${project._count.media} ${
                  project._count.media === 1
                    ? "asset is"
                    : "assets are"
                } currently connected to this project.`
              : "Upload the project’s first assets and organize them into media collections."}
          </p>

          <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4">
            <p className="text-xs leading-6 text-white/35">
              Media uploads directly to Cloudflare R2 and is
              organized into the selected project collection
              automatically.
            </p>
          </div>

          <a
            href="#project-media"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--helios-orange)] px-5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-[var(--helios-orange-hover)]"
          >
            {project._count.media > 0
              ? "Manage assets"
              : "Upload media"}
          </a>
        </aside>
      </section>

      <section
        id="project-media"
        className="scroll-mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02]"
      >
        <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
                Step 02
              </p>

              <h2 className="mt-3 text-2xl font-normal text-white sm:text-3xl">
                Project media
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
                Upload, organize, and manage every asset that will
                appear throughout this project&apos;s portfolio.
              </p>
            </div>

            <p className="text-xs text-white/25">
              {project._count.media}{" "}
              {project._count.media === 1
                ? "asset"
                : "assets"}{" "}
              saved
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <ProjectMediaManager projectId={project.id} />
        </div>
      </section>
    </div>
  );
}