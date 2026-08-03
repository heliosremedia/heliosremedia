import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import RichText from "@/app/components/RichText";
import { tryResolveExternalMedia } from "@/lib/external-media";
import {
  buildPublicPortfolioCollections,
  portfolioCollectionAnchor,
} from "@/lib/portfolio-collections";
import { optimizeProjectSocialImage, resolveProjectSocialImage } from "@/lib/project-social-image";
import { validateProjectPreview } from "@/lib/project-preview";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getAbsoluteUrl, getConfiguredAbsoluteUrl } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";

import PortfolioGallery from "./PortfolioGallery";
import ProjectServiceLinks from "./ProjectServiceLinks";
import ShareProject from "./ShareProject";
import PortfolioAnalytics from "@/app/components/PortfolioAnalytics";
import TrackedProjectVideo from "./TrackedProjectVideo";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{ preview?: string | string[] }>;
};

async function getProject(slug: string, previewToken?: string) {
  const preview = await validateProjectPreview(slug, previewToken);
  return prisma.project.findFirst({
    where: {
      slug,
      ...(preview ? { id: preview.projectId } : { status: "PUBLISHED" as const }),
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
      heroMediaId: true,
      heroMedia: {
        select: {
          id: true,
          sourceType: true,
          storageKey: true,
          originalFilename: true,
          mimeType: true,
          altText: true,
          caption: true,
          width: true,
          height: true,
          aspectRatio: true,
          visibility: true,
          displayOrder: true,
          externalUrl: true,
          focalX: true,
          focalY: true,
        },
      },
      socialImageMedia: {
        select: {
          id: true, sourceType: true, storageKey: true, originalFilename: true,
          mimeType: true, altText: true, width: true, height: true, aspectRatio: true,
          visibility: true, displayOrder: true, externalUrl: true,
        },
      },
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
          propertyWebsiteUrl: true,
        },
      },
      agents: { orderBy: { displayOrder: "asc" }, select: { displayNameSnapshot: true, brokerageSnapshot: true } },
      services: {
        orderBy: {
          service: {
            displayOrder: "asc",
          },
        },
        select: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              active: true,
              archivedAt: true,
            },
          },
        },
      },
      contributors: {
        where: { public: true },
        orderBy: { displayOrder: "asc" },
        select: { displayNameSnapshot: true, titleSnapshot: true, disciplinesSnapshot: true, externalDiscipline: true },
      },
      media: {
        where: {
          visibility: "VISIBLE",
        },
        orderBy: [
          {
            mediaCategory: "asc",
          },
          {
            displayOrder: "asc",
          },
        ],
        select: {
          id: true,
          sourceType: true,
          mediaCategory: true,
          serviceId: true,
          storageKey: true,
          originalFilename: true,
          mimeType: true,
          externalUrl: true,
          altText: true,
          caption: true,
          width: true,
          height: true,
          aspectRatio: true,
          focalX: true,
          focalY: true,
          displayOrder: true,
          visibility: true,
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
  searchParams,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const previewValue = (await searchParams).preview;
  const previewToken = typeof previewValue === "string" ? previewValue : undefined;
  const preview = await validateProjectPreview(slug, previewToken);
  const [project, settings] = await Promise.all([prisma.project.findFirst({
    where: {
      slug,
      ...(preview ? { id: preview.projectId } : { status: "PUBLISHED" as const }),
    },
    select: {
      title: true,
      status: true,
      shortDescription: true,
      seoTitle: true,
      seoDescription: true,
      socialImageMedia: {
        select: {
          id: true, sourceType: true, storageKey: true, mimeType: true, altText: true,
          originalFilename: true, width: true, height: true, aspectRatio: true,
          visibility: true, displayOrder: true, externalUrl: true,
        },
      },
      heroMedia: {
        select: {
          id: true, sourceType: true, storageKey: true, mimeType: true, altText: true,
          originalFilename: true, width: true, height: true, aspectRatio: true,
          visibility: true, displayOrder: true, externalUrl: true,
        },
      },
      media: {
        where: { visibility: "VISIBLE" },
        orderBy: [
          { displayOrder: "asc" },
          { createdAt: "asc" },
        ],
        select: {
          id: true, sourceType: true, storageKey: true, mimeType: true, altText: true,
          originalFilename: true, width: true, height: true, aspectRatio: true,
          visibility: true, displayOrder: true, externalUrl: true,
        },
      },
    },
  }), getSiteSettings()]);

  if (!project) {
    return {
      title: "Project Not Found | Helios Real Estate Media",
    };
  }

  const title =
    project.seoTitle || `${project.title} | Helios Real Estate Media`;
  const description =
    project.seoDescription ||
    project.shortDescription ||
    `View ${project.title}, a project by Helios Real Estate Media.`;
  if (preview || project.status !== "PUBLISHED") {
    return { title, description, robots: { index: false, follow: false } };
  }

  const canonical = getConfiguredAbsoluteUrl(`/portfolio/${slug}`, settings.websiteUrl);
  const image = optimizeProjectSocialImage(
    resolveProjectSocialImage({ ...project, workspace: settings }),
    settings.websiteUrl,
  );
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title, description, type: "article", url: canonical, siteName: settings.businessName,
      images: [{
        url: image.url, secureUrl: image.url, alt: image.alt,
        ...(image.type ? { type: image.type } : {}),
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {}),
      }],
    },
    twitter: {
      card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }],
    },
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function PortfolioProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { slug } = await params;
  const previewValue = (await searchParams).preview;
  const previewToken = typeof previewValue === "string" ? previewValue : undefined;
  const preview = await validateProjectPreview(slug, previewToken);
  const project = await getProject(slug, previewToken);

  if (!project) {
    notFound();
  }

  const heroUrl = project.heroMedia?.storageKey
    ? getPublicAssetUrl(project.heroMedia.storageKey)
    : "";
  const leadVideoMedia = !heroUrl
    ? project.media.find((media) => {
        if (!["VIDEO_EMBED", "UPLOADED_VIDEO"].includes(media.sourceType)) {
          return false;
        }

        const externalMedia = tryResolveExternalMedia(media.externalUrl);
        return Boolean(externalMedia?.embedUrl || externalMedia?.playbackUrl);
      })
    : null;
  const leadVideo = tryResolveExternalMedia(leadVideoMedia?.externalUrl);
  const location =
    project.locationLabel ||
    [project.city, project.state].filter(Boolean).join(", ");
  const activeServices = project.services.filter(
    ({ service }) => service.active && !service.archivedAt,
  );
  const projectUrl = getAbsoluteUrl(`/portfolio/${project.slug}`);
  const resolvedSocialImage = preview ? null : resolveProjectSocialImage(project);
  const structuredImages = [
    resolvedSocialImage?.url || null,
    project.heroMedia?.storageKey
      ? getPublicAssetUrl(project.heroMedia.storageKey)
      : null,
    leadVideo?.thumbnailUrl || null,
    ...project.media.map((media) =>
      media.storageKey ? getPublicAssetUrl(media.storageKey) : null,
    ),
  ].filter((url): url is string => Boolean(url));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": projectUrl,
    url: projectUrl,
    name: project.title,
    description:
      project.seoDescription ||
      project.shortDescription ||
      project.description ||
      `A real estate media project by Helios Real Estate Media.`,
    image: [...new Set(structuredImages)],
    contentLocation: location
      ? {
          "@type": "Place",
          name: location,
        }
      : undefined,
    creator: {
      "@type": "Organization",
      name: "Helios Real Estate Media",
      url: getAbsoluteUrl("/"),
    },
    keywords: activeServices.map(({ service }) => service.name).join(", "),
  };
  const visibleMedia = project.media.filter(
    (media) =>
      media.id !== project.heroMediaId && media.id !== leadVideoMedia?.id,
  );
  const collections = buildPublicPortfolioCollections(
    activeServices.map(({ service }) => service),
    visibleMedia,
  );
  const projectCollectionTitle = `The ${project.title.replace(/^the\s+/i, "")}`;
  const serviceDestinations = new Map(
    activeServices.flatMap(({ service }) => {
      const collection = collections.find(
        (item) => item.service.id === service.id,
      );
      if (collection) return [[service.id, `#${collection.anchor}`] as const];
      if (leadVideoMedia?.serviceId === service.id) {
        return [[service.id, "#project-film"] as const];
      }
      return [];
    }),
  );
  const serviceLinks = activeServices.flatMap(({ service }) => {
    const destination = serviceDestinations.get(service.id);
    return destination
      ? [{ id: service.id, name: service.name, destination }]
      : [];
  });
  const facts = [
    project.details?.squareFeet
      ? {
          label: "Square feet",
          value: formatNumber(project.details.squareFeet),
        }
      : null,
    project.details?.bedrooms
      ? { label: "Bedrooms", value: String(project.details.bedrooms) }
      : null,
    project.details?.bathrooms
      ? { label: "Bathrooms", value: String(project.details.bathrooms) }
      : null,
    project.details?.lotSize
      ? { label: "Lot size", value: project.details.lotSize }
      : null,
    project.details?.neighborhood
      ? { label: "Neighborhood", value: project.details.neighborhood }
      : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  const credits = [
    ...project.contributors.map(contributor => ({
      label: contributor.externalDiscipline || contributor.titleSnapshot,
      value: contributor.displayNameSnapshot,
      internal: !contributor.externalDiscipline,
    })),
    ...(project.agents.length ? project.agents.flatMap((agent) => [
      { label: "Listing agent", value: agent.displayNameSnapshot, internal: false },
      agent.brokerageSnapshot ? { label: "Brokerage", value: agent.brokerageSnapshot, internal: false } : null,
    ]) : [
      project.details?.listingAgent ? { label: "Listing agent", value: project.details.listingAgent, internal: false } : null,
      project.details?.brokerage ? { label: "Brokerage", value: project.details.brokerage, internal: false } : null,
    ]),
    project.details?.builder
      ? { label: "Builder", value: project.details.builder, internal: false }
      : null,
    project.details?.architect
      ? { label: "Architect", value: project.details.architect, internal: false }
      : null,
    project.details?.interiorDesigner
      ? {
          label: "Interior designer",
          value: project.details.interiorDesigner,
          internal: false,
        }
      : null,
  ].filter((credit): credit is { label: string | null; value: string; internal: boolean } =>
    Boolean(credit?.value),
  );

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      {preview && <div className="fixed inset-x-0 top-0 z-[100] flex min-h-10 items-center justify-center bg-[var(--helios-orange)] px-4 text-center text-[0.54rem] font-semibold uppercase tracking-[0.16em] text-black">Private preview · This project is not necessarily published</div>}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <Navbar />
      {!preview && <PortfolioAnalytics page="project" projectId={project.id}/>}

      {leadVideoMedia && leadVideo ? (
        <section id="project-film" className="relative scroll-mt-24 overflow-hidden border-b border-white/[0.08] bg-[#0b0b0c]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(217,107,43,0.16),transparent_34%)]" />
          <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-soft-light" />

          <div className="container-shell relative pb-16 pt-32 sm:pb-20 sm:pt-36">
            <div className="overflow-hidden border border-white/[0.09] bg-black shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
              <TrackedProjectVideo projectId={project.id} mediaId={leadVideoMedia.id} title={leadVideoMedia.originalFilename || project.title} embedUrl={leadVideo.embedUrl || undefined} playbackUrl={leadVideo.playbackUrl || undefined}/>
            </div>

            <div className="mt-10 max-w-5xl sm:mt-14">
              <p className="eyebrow text-[var(--helios-orange)]">
                {location || project.propertyType || "Helios portfolio"}
              </p>
              <h1 className="mt-5 max-w-none font-display text-[clamp(2.75rem,5.2vw,6.5rem)] font-light leading-[0.9] tracking-[-0.055em] text-white sm:whitespace-nowrap">
                {project.title}
              </h1>

              <ProjectServiceLinks links={serviceLinks} />
            </div>
          </div>
        </section>
      ) : (
        <section className="relative min-h-[78vh] overflow-hidden bg-[#111]">
          {heroUrl ? (
            <Image
              src={heroUrl}
              alt={
                project.heroMedia?.altText ||
                project.heroMedia?.originalFilename ||
                project.title
              }
              fill
              preload
              quality={85}
              sizes="100vw"
              className="object-cover"
              style={{
                objectPosition: `${(project.heroMedia?.focalX ?? 0.5) * 100}% ${(project.heroMedia?.focalY ?? 0.5) * 100}%`,
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_25%,rgba(217,107,43,0.2),transparent_35%),#101010]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/45" />
          <div className="hero-grain absolute inset-0 opacity-[0.035] mix-blend-soft-light" />

          <div className="container-shell relative flex min-h-[78vh] items-end pb-14 pt-40 sm:pb-20">
            <div className="max-w-5xl">
              <p className="eyebrow text-[var(--helios-orange)]">
                {location || project.propertyType || "Helios portfolio"}
              </p>

              <h1 className="mt-6 max-w-none font-display text-[clamp(2.75rem,5.2vw,6.5rem)] font-light leading-[0.9] tracking-[-0.06em] text-white sm:whitespace-nowrap">
                {project.title}
              </h1>

              <ProjectServiceLinks links={serviceLinks} overlay />
            </div>
          </div>
        </section>
      )}

      <nav id="project-overview" aria-label="Project navigation" className="scroll-mt-24 border-b border-white/[0.08] bg-[#090909]">
        <div className="container-shell flex flex-wrap items-center justify-between gap-4 py-5">
          <Link href="/portfolio" className="inline-flex items-center gap-3 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/50 transition hover:text-white">
            <span aria-hidden="true">←</span>
            Back to all projects
          </Link>
          <ShareProject projectId={project.id} url={projectUrl} title={project.seoTitle||project.title} summary={project.seoDescription||project.shortDescription||project.description||`Explore ${project.title}.`}/>
        </div>
      </nav>

      {(project.shortDescription ||
        project.description ||
        facts.length > 0) && (
        <section className="container-shell grid gap-14 border-b border-white/[0.08] py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-24">
          <div>
            <p className="eyebrow text-[var(--helios-orange)]">The project</p>

            {project.shortDescription && (
              <h2 className="mt-6 max-w-3xl font-display text-[clamp(1.5rem,1.7vw,2rem)] font-light leading-[1.5] tracking-[-0.018em] text-white/82">
                {project.shortDescription}
              </h2>
            )}

            {project.description && (
              <RichText content={project.description} className="mt-8 max-w-3xl text-base leading-8 text-white/52 sm:text-[1.125rem] sm:leading-9" />
            )}
          </div>

          {(facts.length > 0 ||
            project.projectType ||
            project.propertyType) && (
            <dl className="border-t border-white/[0.1]">
              {project.propertyType && (
                <div className="flex items-start justify-between gap-6 border-b border-white/[0.1] py-5">
                  <dt className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/28">
                    Property
                  </dt>
                  <dd className="text-right text-sm text-white/65">
                    {project.propertyType}
                  </dd>
                </div>
              )}

              {project.projectType && (
                <div className="flex items-start justify-between gap-6 border-b border-white/[0.1] py-5">
                  <dt className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/28">
                    Project
                  </dt>
                  <dd className="text-right text-sm text-white/65">
                    {project.projectType}
                  </dd>
                </div>
              )}

              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-start justify-between gap-6 border-b border-white/[0.1] py-5"
                >
                  <dt className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/28">
                    {fact.label}
                  </dt>
                  <dd className="text-right text-sm text-white/65">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      {collections.map((collection, collectionIndex) => (
        <section
          key={collection.service.id}
          id={portfolioCollectionAnchor(collection.service.id)}
          tabIndex={-1}
          aria-labelledby={`${collection.anchor}-title`}
          className="container-shell scroll-mt-24 border-b border-white/[0.08] py-20 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--helios-orange)]/35 sm:py-28"
        >
          <div className="flex items-end justify-between gap-8">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">
                {String(collectionIndex + 1).padStart(2, "0")} Collection
                <span aria-hidden="true"> · </span>
                {projectCollectionTitle}
              </p>
              <h2 id={`${collection.anchor}-title`} className="mt-4 font-display text-4xl font-light leading-[1.15] tracking-[-0.035em] text-white sm:text-5xl">
                {collection.service.name}
              </h2>
            </div>

            <p className="text-xs text-white/25">
              {collection.media.length}{" "}
              {collection.media.length === 1 ? "asset" : "assets"}
            </p>
          </div>

          <PortfolioGallery
            projectId={project.id}
            projectTitle={project.title}
            collectionLabel={collection.service.name}
            cinematic={collection.media.some((media) => ["VIDEO_EMBED", "UPLOADED_VIDEO"].includes(media.sourceType))}
            items={collection.media.map((media) => ({
              id: media.id,
              imageUrl: media.storageKey
                ? getPublicAssetUrl(media.storageKey)
                : null,
              originalFilename: media.originalFilename,
              width: media.width,
              height: media.height,
              externalUrl: media.externalUrl,
              alt:
                media.altText ||
                media.originalFilename ||
                `${project.title} ${collection.service.name}`,
              caption: media.caption,
              focalX: media.focalX,
              focalY: media.focalY,
              isWide: media.aspectRatio
                ? media.aspectRatio >= 1.35
                : Boolean(
                    media.width &&
                    media.height &&
                    media.width / media.height >= 1.35,
                  ),
              isVertical: media.aspectRatio
                ? media.aspectRatio < 1
                : false,
            }))}
          />
        </section>
      ))}

      {(credits.length > 0 || project.details?.propertyWebsiteUrl) && (
        <section id="project-website" className="container-shell scroll-mt-24 py-20 sm:py-28">
          <div className="grid gap-12 border border-white/[0.08] bg-white/[0.02] p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-14">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">
                Project credits
              </p>

              <div className="mt-7 grid gap-x-12 gap-y-6 sm:grid-cols-2">
                {credits.map((credit) => (
                  <div key={`${credit.label || "contributor"}-${credit.value}`}>
                    {credit.label&&<p className={`text-[0.53rem] font-semibold uppercase tracking-[0.17em] ${credit.internal?"text-[var(--helios-orange)]/75":"text-white/25"}`}>
                      {credit.label}
                    </p>}
                    <p className={`${credit.label?"mt-2":""} font-display text-2xl font-light text-white/75`}>
                      {credit.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {project.details?.propertyWebsiteUrl && (
              <a
                href={project.details.propertyWebsiteUrl}
                target="_blank"
                rel="noreferrer"
                data-analytics-event="OUTBOUND_LINK_CLICK"
                data-analytics-channel="outbound"
                data-analytics-target={project.details.propertyWebsiteUrl}
                className="inline-flex min-h-12 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[var(--helios-orange-hover)]"
              >
                View property website
              </a>
            )}
          </div>
        </section>
      )}

      <section className="border-t border-white/[0.08] bg-[#0d0d0d]">
        <div className="container-shell flex flex-col gap-8 py-20 sm:py-24 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-[var(--helios-orange)]">Explore more</p>
            <h2 className="mt-5 font-display text-5xl font-light tracking-[-0.045em] text-white sm:text-6xl">
              The next story awaits.
            </h2>
          </div>

          <Link
            href="/portfolio"
            className="inline-flex min-h-12 items-center justify-center self-start rounded-full border border-white/15 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/65 transition hover:border-white/35 hover:text-white lg:self-auto"
          >
            <span aria-hidden="true" className="mr-3">←</span>
            Back to all projects
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
