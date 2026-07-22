import type { Metadata } from "next";
import Link from "next/link";

import Footer from "@/app/components/Footer";
import ManagedCtaSection from "@/app/components/ManagedCtaSection";
import Navbar from "@/app/components/Navbar";
import { defaultPageCtas } from "@/lib/ctas";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getServiceMediaCategories } from "@/lib/portfolio-services";

function projectCollectionHref(
  projectSlug: string,
  mediaCategory: ReturnType<typeof getServiceMediaCategories>[number] | undefined,
) {
  if (!mediaCategory) {
    return `/portfolio/${projectSlug}#project-overview`;
  }

  return `/portfolio/${projectSlug}#collection-${mediaCategory
    .toLowerCase()
    .replace(/_/g, "-")}`;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Real Estate Media Services | Helios",
  description:
    "Explore photography, cinematic film, aerial media, agent branding, social content, floor plans, Matterport, and property websites from Helios Real Estate Media.",
  alternates: {
    canonical: "/services",
  },
};

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: {
        select: {
          projects: {
            where: {
              project: { status: "PUBLISHED" },
            },
          },
        },
      },
      projects: {
        where: {
          project: { status: "PUBLISHED" },
        },
        orderBy: { createdAt: "desc" },
        select: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              locationLabel: true,
              city: true,
              state: true,
              heroMedia: {
                select: {
                  storageKey: true,
                  altText: true,
                  originalFilename: true,
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
                      altText: true,
                      originalFilename: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <Navbar variant="solid" />

      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(217,107,43,0.16),transparent_35%)]" />
        <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-soft-light" />

        <div className="container-shell relative py-24 sm:py-32 lg:py-36">
          <p className="eyebrow text-[var(--helios-orange)]">
            Full-service presentation
          </p>

          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end">
            <h1 className="max-w-5xl font-display text-[clamp(3.5rem,8.5vw,8rem)] font-light leading-[0.86] tracking-[-0.058em] text-white">
              Every asset. One cohesive story.
            </h1>

            <div>
              <p className="text-sm leading-7 text-white/42 sm:text-base">
                Media systems built to elevate the property, strengthen the
                agent, and make every campaign feel intentional from first
                impression to final showing.
              </p>
              <p className="mt-6 text-[0.57rem] font-semibold uppercase tracking-[0.18em] text-white/22">
                Northern Colorado · On location
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-shell border-b border-white/[0.08] py-8 sm:py-10">
        <nav
          aria-label="Service index"
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {services.map((service, index) => (
            <a
              key={service.id}
              href={`#${service.slug}`}
              className="shrink-0 rounded-full border border-white/10 px-4 py-2.5 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-white/38 transition hover:border-white/25 hover:text-white"
            >
              {String(index + 1).padStart(2, "0")} {service.name}
            </a>
          ))}
        </nav>
      </section>

      {services.length > 0 ? (
        <div>
          {services.map((service, serviceIndex) => {
            const serviceMediaCategories = getServiceMediaCategories(service);
            const primaryMediaCategory = serviceMediaCategories[0];
            const eligibleProjects = service.projects.map(({ project }) => {
              // Service imagery is category-specific: a Drone Photography
              // preview must use that project's Drone hero, never its general
              // Photography/project cover unless no Drone hero exists.
              const collectionHero = project.collectionHeroes.find(
                (hero) => hero.mediaCategory === primaryMediaCategory,
              )?.media;
              const imageStorageKey =
                collectionHero?.storageKey || project.heroMedia?.storageKey;

              return imageStorageKey ? {
                ...project,
                collectionHero,
                imageUrl: imageStorageKey
                  ? getPublicAssetUrl(imageStorageKey)
                  : "",
                location:
                  project.locationLabel ||
                  [project.city, project.state].filter(Boolean).join(", "),
              } : null;
            }).filter((project): project is NonNullable<typeof project> => Boolean(project));
            const projectPreviews = serviceIndex < 3
              ? eligibleProjects.map((project) => ({ project, score: Math.random() })).sort((a, b) => a.score - b.score).slice(0, 3).map(({ project }) => project)
              : eligibleProjects.slice(0, 3);

            return (
              <section
                key={service.id}
                id={service.slug}
                className="scroll-mt-8 border-b border-white/[0.08]"
              >
                <div className="container-shell grid gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] lg:items-center lg:gap-20">
                  <div className={serviceIndex % 2 === 1 ? "lg:order-2" : ""}>
                    <p className="eyebrow text-[var(--helios-orange)]">
                      Service {String(serviceIndex + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-6 font-display text-[clamp(2.8rem,5.5vw,5.5rem)] font-light leading-[0.93] tracking-[-0.05em] text-white">
                      {service.name}
                    </h2>
                    <p className="mt-7 max-w-xl text-sm leading-7 text-white/42 sm:text-base sm:leading-8">
                      {service.description ||
                        "A specialized Helios service designed for premium real estate presentation."}
                    </p>

                    <div className="mt-9 flex flex-wrap items-center gap-4">
                      <Link
                        href={`/portfolio?service=${service.slug}#${service.slug}`}
                        className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/60 transition hover:border-white/35 hover:text-white"
                      >
                        View related work
                      </Link>
                      {service._count.projects > 0 && (
                        <span className="text-xs text-white/22">
                          {service._count.projects}{" "}
                          {service._count.projects === 1
                            ? "project"
                            : "projects"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`grid min-h-[26rem] gap-3 sm:grid-cols-2 ${
                      serviceIndex % 2 === 1 ? "lg:order-1" : ""
                    }`}
                  >
                    {projectPreviews.length > 0 ? (
                      projectPreviews.map((project, projectIndex) => (
                        <article
                          key={project.id}
                          className={`group relative min-h-64 overflow-hidden bg-[#111] ${
                            projectIndex === 0
                              ? "sm:row-span-2 sm:min-h-[34rem]"
                              : ""
                          }`}
                        >
                          <Link
                            href={projectCollectionHref(
                              project.slug,
                              primaryMediaCategory,
                            )}
                            aria-label={`View ${project.title}`}
                            className="absolute inset-0 z-10"
                          />
                          {project.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={project.imageUrl}
                              alt={
                                project.collectionHero?.altText ||
                                project.collectionHero?.originalFilename ||
                                project.heroMedia?.altText ||
                                project.heroMedia?.originalFilename ||
                                project.title
                              }
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover transition duration-1000 ease-[var(--ease-luxury)] group-hover:scale-[1.04]"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(217,107,43,0.18),transparent_34%),#111]" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-5">
                            <p className="text-[0.52rem] font-semibold uppercase tracking-[0.15em] text-white/40">
                              {project.location || "Helios project"}
                            </p>
                            <h3 className="mt-2 font-display text-2xl font-light tracking-[-0.035em] text-white">
                              {project.title}
                            </h3>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="relative col-span-full overflow-hidden border border-white/[0.08] bg-[#111]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(217,107,43,0.18),transparent_34%),#0d0d0d]" />
                        <div className="hero-grain absolute inset-0 opacity-[0.03]" />
                        <div className="relative flex min-h-[26rem] items-end p-7">
                          <p className="max-w-sm font-display text-3xl font-light leading-tight text-white/35">
                            Published {service.name.toLowerCase()} projects will
                            appear here automatically.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="container-shell py-24 text-center sm:py-32">
          <h2 className="font-display text-4xl font-light text-white">
            Our service catalog is being refined.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/35">
            Active services managed through the Helios admin will appear here
            automatically.
          </p>
        </section>
      )}

      <ManagedCtaSection slot="SERVICES_FOOTER" fallback={defaultPageCtas.SERVICES_FOOTER} />

      <Footer />
    </main>
  );
}
