import Link from "next/link";
import { notFound } from "next/navigation";

import { tryResolveExternalMedia } from "@/lib/external-media";
import { prisma } from "@/lib/prisma";

import ProjectDetailsEditor from "./ProjectDetailsEditor";
import ProjectMediaManager from "./ProjectMediaManager";
import ProjectWorkflowManager from "./ProjectWorkflowManager";
import ProjectPreviewManager from "./ProjectPreviewManager";

export const dynamic = "force-dynamic";

type ProjectEditorPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusClasses(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200";
    case "ARCHIVED":
      return "border-white/10 bg-white/[0.04] text-white/45";
    default:
      return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";
  }
}

export default async function ProjectEditorPage({
  params,
}: ProjectEditorPageProps) {
  const { projectId } = await params;

  const [project, services] = await Promise.all([
    prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        description: true,
        city: true,
        state: true,
        locationLabel: true,
        projectType: true,
        propertyType: true,
        seoTitle: true,
        seoDescription: true,
        status: true,
        featured: true,
        heroMediaId: true,
        heroMedia: {
          select: {
            visibility: true,
          },
        },
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        details: {
          select: {
            listingAgent: true,
            brokerage: true,
            builder: true,
            architect: true,
            interiorDesigner: true,
            squareFeet: true,
            bedrooms: true,
            bathrooms: true,
            lotSize: true,
            neighborhood: true,
            propertyAddress: true,
            propertyWebsiteUrl: true,
          },
        },
        media: {
          where: {
            visibility: "VISIBLE",
          },
          select: {
            id: true,
            sourceType: true,
            externalUrl: true,
          },
        },
        services: {
          select: {
            serviceId: true,
          },
        },
        _count: {
          select: {
            media: true,
            services: true,
          },
        },
        previewLinks: { orderBy: { createdAt: "desc" }, take: 25, select: { id: true, label: true, expiresAt: true, createdAt: true, lastUsedAt: true, revokedAt: true } },
      },
    }),
    prisma.service.findMany({
      orderBy: [
        {
          displayOrder: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        active: true,
        displayOrder: true,
      },
    }),
  ]);

  if (!project) {
    notFound();
  }

  const hasPlayableVideo = project.media.some((media) => {
    if (!["VIDEO_EMBED", "UPLOADED_VIDEO"].includes(media.sourceType)) {
      return false;
    }

    const externalMedia = tryResolveExternalMedia(media.externalUrl);
    return Boolean(externalMedia?.embedUrl || externalMedia?.playbackUrl);
  });

  return (
    <div className="space-y-7">
      <section className="border-b border-white/[0.08] pb-7">
        <Link
          href="/admin/projects"
          className="admin-btn-link"
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

              <span
                className={`rounded-full border px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.14em] ${statusClasses(
                  project.status,
                )}`}
              >
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

          <div className="flex flex-col items-start gap-2 sm:items-end">
            {project.status === "PUBLISHED" && (
              <Link
                href={`/portfolio/${project.slug}`}
                className="text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-[var(--helios-orange)] transition hover:text-[var(--helios-orange-hover)]"
              >
                View live project
              </Link>
            )}

            <p className="text-xs text-white/25">
              {project._count.media > 0
                ? `${project._count.media} ${
                    project._count.media === 1 ? "asset" : "assets"
                  } saved`
                : "Ready for project media"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          [
            "01",
            "Details",
            project.shortDescription
              ? "Ready"
              : hasPlayableVideo
                ? "Video-led"
                : "Add summary",
            Boolean(project.shortDescription) || hasPlayableVideo,
          ],
          [
            "02",
            "Media",
            `${project._count.media} ${
              project._count.media === 1 ? "asset" : "assets"
            }`,
            true,
          ],
          [
            "03",
            "Services",
            `${project._count.services} selected`,
            project._count.services > 0,
          ],
          [
            "04",
            "Publish",
            project.status === "PUBLISHED"
              ? "Live"
              : project.status === "ARCHIVED"
                ? "Archived"
                : "Draft",
            project.status === "PUBLISHED",
          ],
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
                active ? "text-[var(--helios-orange-hover)]" : "text-white/25"
              }`}
            >
              Step {number}
            </p>

            <h2 className="mt-3 text-xl font-normal text-white">{label}</h2>

            <p className="mt-2 text-xs text-white/30">{detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ProjectDetailsEditor
          projectId={project.id}
          statusLabel={formatStatus(project.status)}
          initialData={{
            title: project.title,
            slug: project.slug,
            shortDescription: project.shortDescription || "",
            description: project.description || "",
            city: project.city || "",
            state: project.state || "",
            locationLabel: project.locationLabel || "",
            projectType: project.projectType || "",
            propertyType: project.propertyType || "",
            seoTitle: project.seoTitle || "",
            seoDescription: project.seoDescription || "",
            listingAgent: project.details?.listingAgent || "",
            brokerage: project.details?.brokerage || "",
            builder: project.details?.builder || "",
            architect: project.details?.architect || "",
            interiorDesigner: project.details?.interiorDesigner || "",
            squareFeet: project.details?.squareFeet?.toString() || "",
            bedrooms: project.details?.bedrooms?.toString() || "",
            bathrooms: project.details?.bathrooms?.toString() || "",
            lotSize: project.details?.lotSize || "",
            neighborhood: project.details?.neighborhood || "",
            propertyAddress: project.details?.propertyAddress || "",
            propertyWebsiteUrl: project.details?.propertyWebsiteUrl || "",
          }}
        />

        <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 xl:self-start">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
            Media status
          </p>

          <h2 className="mt-3 text-2xl font-normal text-white">
            {project._count.media > 0 ? "Media connected" : "Add project media"}
          </h2>

          <p className="mt-3 text-sm leading-6 text-white/40">
            {project._count.media > 0
              ? `${project._count.media} ${
                  project._count.media === 1 ? "asset is" : "assets are"
                } currently connected to this project.`
              : "Upload the project’s first assets and organize them into media collections."}
          </p>

          <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4">
            <p className="text-xs leading-6 text-white/35">
              Media uploads directly to Cloudflare R2 and is organized into the
              selected project collection automatically.
            </p>
          </div>

          <a
            href="#project-media"
            className="mt-5 w-full admin-btn-primary"
          >
            {project._count.media > 0 ? "Manage assets" : "Upload media"}
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
                Upload, organize, and manage every asset that will appear
                throughout this project&apos;s portfolio.
              </p>
            </div>

            <p className="text-xs text-white/25">
              {project._count.media}{" "}
              {project._count.media === 1 ? "asset" : "assets"} saved
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <ProjectMediaManager projectId={project.id} />
        </div>
      </section>

      <ProjectWorkflowManager
        projectId={project.id}
        projectSlug={project.slug}
        initialStatus={project.status}
        initialFeatured={project.featured}
        initialPublishedAt={project.publishedAt?.toISOString() ?? null}
        heroMediaId={
          project.heroMedia?.visibility === "VISIBLE"
            ? project.heroMediaId
            : null
        }
        visibleMediaCount={project.media.length}
        hasProjectSummary={Boolean(project.shortDescription)}
        hasPlayableVideo={hasPlayableVideo}
        services={services}
        initialServiceIds={project.services.map(
          (projectService) => projectService.serviceId,
        )}
      />
      <ProjectPreviewManager projectId={project.id} initialPreviews={project.previewLinks.map((item) => ({ ...item, expiresAt: item.expiresAt.toISOString(), createdAt: item.createdAt.toISOString(), lastUsedAt: item.lastUsedAt?.toISOString() ?? null, revokedAt: item.revokedAt?.toISOString() ?? null }))} />
    </div>
  );
}
