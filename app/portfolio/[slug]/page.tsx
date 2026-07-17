import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Footer from "@/app/components/Footer";
import { MEDIA_COLLECTIONS } from "@/lib/media-collections";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getAbsoluteUrl } from "@/lib/site";

import PortfolioGallery from "./PortfolioGallery";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function getPublishedProject(slug: string) {
  return prisma.project.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
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
          storageKey: true,
          originalFilename: true,
          altText: true,
          caption: true,
          focalX: true,
          focalY: true,
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
            },
          },
        },
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
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await prisma.project.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
    },
    select: {
      title: true,
      shortDescription: true,
      seoTitle: true,
      seoDescription: true,
      heroMedia: {
        select: {
          storageKey: true,
          altText: true,
        },
      },
    },
  });

  if (!project) {
    return {
      title: "Project Not Found | Helios Real Estate Media",
    };
  }

  const image = project.heroMedia?.storageKey
    ? getPublicAssetUrl(project.heroMedia.storageKey)
    : undefined;
  const title =
    project.seoTitle || `${project.title} | Helios Real Estate Media`;
  const description =
    project.seoDescription ||
    project.shortDescription ||
    `View ${project.title}, a project by Helios Real Estate Media.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/portfolio/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/portfolio/${slug}`,
      images: image
        ? [
            {
              url: image,
              alt: project.heroMedia?.altText || project.title,
            },
          ]
        : undefined,
    },
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function PortfolioProjectPage({
  params,
}: ProjectPageProps) {
  const { slug } = await params;
  const project = await getPublishedProject(slug);

  if (!project) {
    notFound();
  }

  const heroUrl = project.heroMedia?.storageKey
    ? getPublicAssetUrl(project.heroMedia.storageKey)
    : "";
  const location =
    project.locationLabel ||
    [project.city, project.state].filter(Boolean).join(", ");
  const activeServices = project.services.filter(
    ({ service }) => service.active,
  );
  const projectUrl = getAbsoluteUrl(`/portfolio/${project.slug}`);
  const structuredImages = [
    project.heroMedia?.storageKey
      ? getPublicAssetUrl(project.heroMedia.storageKey)
      : null,
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
    (media) => media.id !== project.heroMediaId,
  );
  const collections = MEDIA_COLLECTIONS.map((collection) => ({
    ...collection,
    media: visibleMedia.filter(
      (media) => media.mediaCategory === collection.value,
    ),
  })).filter((collection) => collection.media.length > 0);
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
    project.details?.listingAgent
      ? { label: "Listing agent", value: project.details.listingAgent }
      : null,
    project.details?.brokerage
      ? { label: "Brokerage", value: project.details.brokerage }
      : null,
    project.details?.builder
      ? { label: "Builder", value: project.details.builder }
      : null,
    project.details?.architect
      ? { label: "Architect", value: project.details.architect }
      : null,
    project.details?.interiorDesigner
      ? {
          label: "Interior designer",
          value: project.details.interiorDesigner,
        }
      : null,
  ].filter((credit): credit is { label: string; value: string } =>
    Boolean(credit),
  );

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/[0.1] bg-black/20 backdrop-blur-xl">
        <div className="container-shell flex min-h-24 items-center justify-between gap-6 py-5">
          <Link href="/" aria-label="Helios Real Estate Media home">
            <Image
              src="/brand/helios-logo.png"
              alt="Helios Real Estate Media"
              width={260}
              height={90}
              priority
              className="h-auto w-40 sm:w-48"
            />
          </Link>

          <nav
            className="flex items-center gap-5 sm:gap-8"
            aria-label="Project"
          >
            <Link
              href="/portfolio"
              className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
            >
              All work
            </Link>

            <Link
              href="tel:+19706825533"
              className="inline-flex min-h-11 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-5 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[var(--helios-orange-hover)]"
            >
              Book now
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative min-h-[78vh] overflow-hidden bg-[#111]">
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt={
              project.heroMedia?.altText ||
              project.heroMedia?.originalFilename ||
              project.title
            }
            className="absolute inset-0 h-full w-full object-cover"
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

            <h1 className="mt-6 font-display text-[clamp(3.6rem,9vw,8.5rem)] font-light leading-[0.84] tracking-[-0.06em] text-white">
              {project.title}
            </h1>

            {activeServices.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {activeServices.map(({ service }) => (
                  <Link
                    key={service.id}
                    href={`/portfolio?service=${service.slug}`}
                    className="rounded-full border border-white/20 bg-black/20 px-3.5 py-2 text-[0.52rem] font-semibold uppercase tracking-[0.15em] text-white/70 backdrop-blur-md transition hover:border-white/40 hover:text-white"
                  >
                    {service.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {(project.shortDescription ||
        project.description ||
        facts.length > 0) && (
        <section className="container-shell grid gap-14 border-b border-white/[0.08] py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-24">
          <div>
            <p className="eyebrow text-[var(--helios-orange)]">The project</p>

            {project.shortDescription && (
              <h2 className="mt-6 max-w-4xl font-display text-[clamp(2.5rem,5vw,5rem)] font-light leading-[0.98] tracking-[-0.045em] text-white">
                {project.shortDescription}
              </h2>
            )}

            {project.description && (
              <p className="mt-8 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/45 sm:text-base sm:leading-8">
                {project.description}
              </p>
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
          key={collection.value}
          className="container-shell border-b border-white/[0.08] py-20 sm:py-28"
        >
          <div className="flex items-end justify-between gap-8">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">
                {String(collectionIndex + 1).padStart(2, "0")} Collection
              </p>
              <h2 className="mt-4 font-display text-4xl font-light tracking-[-0.035em] text-white sm:text-5xl">
                {collection.label}
              </h2>
            </div>

            <p className="text-xs text-white/25">
              {collection.media.length}{" "}
              {collection.media.length === 1 ? "asset" : "assets"}
            </p>
          </div>

          <PortfolioGallery
            projectTitle={project.title}
            collectionLabel={collection.label}
            items={collection.media.map((media) => ({
              id: media.id,
              imageUrl: media.storageKey
                ? getPublicAssetUrl(media.storageKey)
                : null,
              externalUrl: media.externalUrl,
              alt:
                media.altText ||
                media.originalFilename ||
                `${project.title} ${collection.label}`,
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
            }))}
          />
        </section>
      ))}

      {(credits.length > 0 || project.details?.propertyWebsiteUrl) && (
        <section className="container-shell py-20 sm:py-28">
          <div className="grid gap-12 border border-white/[0.08] bg-white/[0.02] p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-14">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">
                Project credits
              </p>

              <div className="mt-7 grid gap-x-12 gap-y-6 sm:grid-cols-2">
                {credits.map((credit) => (
                  <div key={credit.label}>
                    <p className="text-[0.53rem] font-semibold uppercase tracking-[0.17em] text-white/25">
                      {credit.label}
                    </p>
                    <p className="mt-2 font-display text-2xl font-light text-white/75">
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
            View all projects
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
