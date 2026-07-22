import type { Metadata } from "next";
import Link from "next/link";

import Footer from "@/app/components/Footer";
import ManagedCtaSection from "@/app/components/ManagedCtaSection";
import Navbar from "@/app/components/Navbar";
import { tryResolveExternalMedia } from "@/lib/external-media";
import { getServiceMediaCategories } from "@/lib/portfolio-services";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { defaultPageCtas } from "@/lib/ctas";

import PortfolioFilmLibrary from "./PortfolioFilmLibrary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio | Helios Real Estate Media",
  description:
    "Explore photography, cinematic films, aerial media, agent branding, and social content created by Helios Real Estate Media.",
  alternates: {
    canonical: "/portfolio",
  },
};

type PortfolioPageProps = {
  searchParams: Promise<{
    service?: string | string[];
    page?: string | string[];
  }>;
};

function getServiceParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function PortfolioPage({
  searchParams,
}: PortfolioPageProps) {
  const { service: requestedService, page: requestedPage } = await searchParams;
  const serviceSlug = getServiceParam(requestedService);
  const pageNumber = Math.max(1, Number.parseInt(getServiceParam(requestedPage), 10) || 1);

  const services = await prisma.service.findMany({
    where: {
      active: true,
    },
    orderBy: [
      {
        displayOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
  const selectedService = services.find(
    (service) => service.slug === serviceSlug,
  );
  const selectedMediaCategories = getServiceMediaCategories(selectedService);
  const showFilmLibrary = selectedMediaCategories.includes("CINEMATIC_FILM");

  const [projects, filmMedia] = await Promise.all([
    prisma.project.findMany({
      where: {
        status: "PUBLISHED",
        ...(selectedService
          ? {
              OR: [
                {
                  services: {
                    some: {
                      serviceId: selectedService.id,
                      service: {
                        active: true,
                      },
                    },
                  },
                },
                ...(selectedMediaCategories.length > 0
                  ? [
                      {
                        media: {
                          some: {
                            visibility: "VISIBLE" as const,
                            mediaCategory: {
                              in: selectedMediaCategories,
                            },
                          },
                        },
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: [
        {
          featured: "desc",
        },
        {
          displayOrder: "asc",
        },
        {
          publishedAt: "desc",
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
        propertyType: true,
        featured: true,
        heroMedia: {
          select: {
            storageKey: true,
            originalFilename: true,
            altText: true,
          },
        },
        collectionHeroes: {
          where: {
            media: {
              visibility: "VISIBLE",
              storageKey: { not: null },
              sourceType: "UPLOADED_IMAGE",
            },
          },
          select: {
            mediaCategory: true,
            media: {
              select: {
                storageKey: true,
                originalFilename: true,
                altText: true,
              },
            },
          },
        },
        details: {
          select: {
            propertyWebsiteUrl: true,
          },
        },
        media: {
          where: {
            visibility: "VISIBLE",
          },
          orderBy: [
            { displayOrder: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            externalUrl: true,
            sourceType: true,
            mediaCategory: true,
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
      },
    }),
    showFilmLibrary
      ? prisma.media.findMany({
          where: {
            visibility: "VISIBLE",
            sourceType: "VIDEO_EMBED",
            mediaCategory: "CINEMATIC_FILM",
            externalUrl: {
              not: null,
            },
            project: {
              status: "PUBLISHED",
            },
          },
          orderBy: [
            { project: { featured: "desc" } },
            { project: { displayOrder: "asc" } },
            { displayOrder: "asc" },
            { createdAt: "desc" },
          ],
          select: {
            id: true,
            originalFilename: true,
            externalUrl: true,
            project: {
              select: {
                title: true,
                slug: true,
                locationLabel: true,
                city: true,
                state: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const films = filmMedia.flatMap((media) =>
    media.externalUrl
      ? [
          {
            id: media.id,
            title: media.originalFilename || media.project.title,
            externalUrl: media.externalUrl,
            project: {
              title: media.project.title,
              slug: media.project.slug,
              location:
                media.project.locationLabel ||
                [media.project.city, media.project.state]
                  .filter(Boolean)
                  .join(", ") ||
                null,
            },
          },
        ]
      : [],
  );
  const leadProject = projects[0]?.featured ? projects[0] : null;
  const regularProjects = leadProject ? projects.slice(1) : projects;
  const pageSize = 18;
  const totalPages = Math.max(1, Math.ceil(regularProjects.length / pageSize));
  const currentPage = Math.min(pageNumber, totalPages);
  const displayedProjects = regularProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageProjects = currentPage === 1 && leadProject ? [leadProject, ...displayedProjects] : displayedProjects;
  const pageHref = (page: number) => `/portfolio?${new URLSearchParams({ ...(selectedService ? { service: selectedService.slug } : {}), ...(page > 1 ? { page: String(page) } : {}) }).toString()}#selected-work`;

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <Navbar variant="solid" />

      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(217,107,43,0.14),transparent_34%)]" />
        <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-soft-light" />

        <div className="container-shell relative py-20 sm:py-28 lg:py-32">
          <p className="eyebrow text-[var(--helios-orange)]">
            The Helios portfolio
          </p>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end">
            <h1 className="max-w-4xl font-display text-[clamp(3.3rem,8vw,7.5rem)] font-light leading-[0.86] tracking-[-0.055em] text-white">
              Work designed to move people.
            </h1>

            <p className="max-w-xl text-sm leading-7 text-white/42 sm:text-base">
              Explore property stories, agent brands, and marketing experiences
              built with intention across Northern Colorado.
            </p>
          </div>
        </div>
      </section>

      <section id="portfolio-filters" className="container-shell scroll-mt-24 py-8 sm:py-10">
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          aria-label="Filter portfolio"
        >
          <Link
            href="/portfolio#portfolio-filters"
            className={`shrink-0 rounded-full border px-4 py-2.5 text-[0.56rem] font-semibold uppercase tracking-[0.15em] transition ${
              !selectedService
                ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
                : "border-white/10 text-white/45 hover:border-white/25 hover:text-white"
            }`}
          >
            All work
          </Link>

          {services.map((service) => (
            <Link
              key={service.id}
              href={`/portfolio?service=${service.slug}#portfolio-filters`}
              className={`shrink-0 rounded-full border px-4 py-2.5 text-[0.56rem] font-semibold uppercase tracking-[0.15em] transition ${
                selectedService?.id === service.id
                  ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
                  : "border-white/10 text-white/45 hover:border-white/25 hover:text-white"
              }`}
            >
              {service.name}
            </Link>
          ))}
        </div>
      </section>

      <section id="selected-work" className="container-shell scroll-mt-28 pb-24 sm:pb-32">
        <div className="flex flex-col gap-3 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/30">
              {selectedService ? "Filtered collection" : "Published projects"}
            </p>

            <h2 className="mt-2 font-display text-3xl font-light text-white sm:text-4xl">
              {selectedService?.name || "Selected work"}
            </h2>
          </div>

          <p className="text-xs text-white/30">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>

        {pageProjects.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pageProjects.map((project) => {
              const assignedServiceIds = new Set(
                project.services
                  .filter(({ service }) => service.active)
                  .map(({ service }) => service.id),
              );
              const mediaCategories = new Set(
                project.media.map((media) => media.mediaCategory),
              );
              const badgeServices = services.filter((service) => {
                if (assignedServiceIds.has(service.id)) {
                  return true;
                }

                const inferredFromMedia = getServiceMediaCategories(
                  service,
                ).some((category) => mediaCategories.has(category));

                if (inferredFromMedia) {
                  return true;
                }

                return (
                  Boolean(project.details?.propertyWebsiteUrl) &&
                  getServiceMediaCategories(service).includes(
                    "PROPERTY_WEBSITE",
                  )
                );
              });
              const firstVideo = project.media.find(
                (media) =>
                  media.sourceType === "VIDEO_EMBED" && media.externalUrl,
              );
              const videoMedia = tryResolveExternalMedia(
                firstVideo?.externalUrl,
              );
              const collectionHero = project.collectionHeroes.find((hero) =>
                selectedMediaCategories.includes(hero.mediaCategory),
              )?.media;
              const imageStorageKey =
                collectionHero?.storageKey || project.heroMedia?.storageKey;
              const imageUrl = imageStorageKey
                ? getPublicAssetUrl(imageStorageKey)
                : videoMedia?.thumbnailUrl || "";
              const location =
                project.locationLabel ||
                [project.city, project.state].filter(Boolean).join(", ");

              return (
                <article
                  key={project.id}
                  className={`group relative overflow-hidden border border-white/[0.08] bg-black ${
                    project === leadProject && currentPage === 1
                      ? "md:col-span-2 xl:col-span-3"
                      : ""
                  }`}
                >
                  <Link
                    href={`/portfolio/${project.slug}`}
                    aria-label={`View ${project.title}`}
                    className="absolute inset-0 z-20"
                  />

                  <div
                    className={`relative overflow-hidden bg-white/[0.03] ${
                      project === leadProject && currentPage === 1
                        ? "aspect-[16/9] xl:aspect-[2.35/1]"
                        : "aspect-[4/3]"
                    }`}
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={
                          collectionHero?.altText ||
                          collectionHero?.originalFilename ||
                          project.heroMedia?.altText ||
                          project.heroMedia?.originalFilename ||
                          project.title
                        }
                        className="h-full w-full object-cover transition duration-1000 ease-[var(--ease-luxury)] group-hover:scale-[1.045]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(217,107,43,0.18),transparent_34%),#111]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-90" />

                    {project === leadProject && currentPage === 1 && (
                      <span className="absolute left-5 top-5 rounded-full border border-[var(--helios-orange)]/35 bg-[var(--helios-orange)] px-3 py-1.5 text-[0.52rem] font-semibold uppercase tracking-[0.15em] text-black">
                        Featured project
                      </span>
                    )}

                    {!imageStorageKey && videoMedia && (
                      <span className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-md">
                        <svg viewBox="0 0 24 24" fill="none" className="ml-0.5 h-4 w-4" aria-hidden="true">
                          <path d="m9 7 8 5-8 5V7Z" fill="currentColor" />
                        </svg>
                      </span>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/50">
                        {location || project.propertyType || "Helios project"}
                      </p>

                      <h3 className="mt-3 font-display text-3xl font-light leading-none tracking-[-0.035em] text-white sm:text-4xl">
                        {project.title}
                      </h3>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {badgeServices.map((service) => (
                          <span
                            key={service.id}
                            className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[0.5rem] font-semibold uppercase tracking-[0.13em] text-white/65 backdrop-blur-md"
                          >
                            {service.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 border border-white/[0.08] bg-white/[0.02] px-6 py-20 text-center">
            <h3 className="font-display text-3xl font-light text-white">
              This collection is being curated.
            </h3>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/35">
              Published projects assigned to this service will appear here
              automatically.
            </p>

            {selectedService && (
              <Link
                href="/portfolio#portfolio-filters"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/60 transition hover:border-white/30 hover:text-white"
              >
                View all work
              </Link>
            )}
          </div>
        )}
        {totalPages > 1 && <nav aria-label="Portfolio pages" className="mt-14 flex flex-wrap items-center justify-center gap-2">
          {currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="rounded-full border border-white/12 px-5 py-3 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/55 hover:border-white/30 hover:text-white">Previous</Link>}
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <Link key={page} href={pageHref(page)} aria-current={page === currentPage ? "page" : undefined} className={`flex h-11 w-11 items-center justify-center rounded-full border text-xs transition ${page === currentPage ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black" : "border-white/12 text-white/45 hover:border-white/30 hover:text-white"}`}>{page}</Link>)}
          {currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded-full border border-white/12 px-5 py-3 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/55 hover:border-white/30 hover:text-white">Next</Link>}
        </nav>}
      </section>

      {showFilmLibrary && <PortfolioFilmLibrary films={films} />}

      <ManagedCtaSection slot="PORTFOLIO_FOOTER" fallback={defaultPageCtas.PORTFOLIO_FOOTER} />
      <Footer />
    </main>
  );
}
