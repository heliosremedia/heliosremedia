import type { Metadata } from "next";
import Link from "next/link";

import Footer from "@/app/components/Footer";
import ManagedCtaSection from "@/app/components/ManagedCtaSection";
import Navbar from "@/app/components/Navbar";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { defaultPageCtas } from "@/lib/ctas";

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
  }>;
};

function getServiceParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function PortfolioPage({
  searchParams,
}: PortfolioPageProps) {
  const { service: requestedService } = await searchParams;
  const serviceSlug = getServiceParam(requestedService);

  const [services, projects] = await Promise.all([
    prisma.service.findMany({
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
    }),
    prisma.project.findMany({
      where: {
        status: "PUBLISHED",
        ...(serviceSlug
          ? {
              services: {
                some: {
                  service: {
                    slug: serviceSlug,
                    active: true,
                  },
                },
              },
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
  ]);

  const selectedService = services.find(
    (service) => service.slug === serviceSlug,
  );

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

      <section className="container-shell py-8 sm:py-10">
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          aria-label="Filter portfolio"
        >
          <Link
            href="/portfolio"
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
              href={`/portfolio?service=${service.slug}`}
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

      <section className="container-shell pb-24 sm:pb-32">
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

        {projects.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project, index) => {
              const imageUrl = project.heroMedia?.storageKey
                ? getPublicAssetUrl(project.heroMedia.storageKey)
                : "";
              const location =
                project.locationLabel ||
                [project.city, project.state].filter(Boolean).join(", ");

              return (
                <article
                  key={project.id}
                  className={`group relative overflow-hidden border border-white/[0.08] bg-black ${
                    project.featured && index === 0
                      ? "md:col-span-2 xl:col-span-2"
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
                      project.featured && index === 0
                        ? "aspect-[16/9]"
                        : "aspect-[4/3]"
                    }`}
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={
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

                    {project.featured && (
                      <span className="absolute left-5 top-5 rounded-full border border-[var(--helios-orange)]/35 bg-[var(--helios-orange)] px-3 py-1.5 text-[0.52rem] font-semibold uppercase tracking-[0.15em] text-black">
                        Featured project
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
                        {project.services
                          .filter(({ service }) => service.active)
                          .slice(0, 3)
                          .map(({ service }) => (
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
                href="/portfolio"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/60 transition hover:border-white/30 hover:text-white"
              >
                View all work
              </Link>
            )}
          </div>
        )}
      </section>

      <ManagedCtaSection slot="PORTFOLIO_FOOTER" fallback={defaultPageCtas.PORTFOLIO_FOOTER} />
      <Footer />
    </main>
  );
}
