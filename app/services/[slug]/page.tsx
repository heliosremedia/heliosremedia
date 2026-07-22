import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Footer from "@/app/components/Footer";
import ManagedCtaSection from "@/app/components/ManagedCtaSection";
import Navbar from "@/app/components/Navbar";
import { defaultPageCtas } from "@/lib/ctas";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { buildPageMetadata } from "@/lib/seo";
import { getAbsoluteUrl } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

type ServicePageProps = { params: Promise<{ slug: string }> };

async function getService(slug: string) {
  return prisma.service.findFirst({
    where: { slug, active: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      projects: {
        where: { project: { status: "PUBLISHED" } },
        orderBy: { project: { publishedAt: "desc" } },
        take: 9,
        select: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              shortDescription: true,
              city: true,
              state: true,
              locationLabel: true,
              heroMedia: { select: { storageKey: true, altText: true, originalFilename: true } },
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const [service, settings] = await Promise.all([getService(slug), getSiteSettings()]);
  if (!service) return { title: "Service Not Found | Helios", robots: { index: false, follow: false } };
  const title = `${service.name} in Northern Colorado | Helios`;
  const description = service.description || `Explore professional ${service.name.toLowerCase()} for real estate agents, builders, and exceptional properties across Northern Colorado.`;
  const hero = service.projects.find(({ project }) => project.heroMedia?.storageKey)?.project.heroMedia;
  return buildPageMetadata({ title, description, path: `/services/${slug}`, settings, image: hero?.storageKey ? getPublicAssetUrl(hero.storageKey) : null, imageAlt: hero?.altText || service.name });
}

export default async function ServiceDetailPage({ params }: ServicePageProps) {
  const { slug } = await params;
  const [service, settings] = await Promise.all([getService(slug), getSiteSettings()]);
  if (!service) notFound();

  const projects = service.projects.map(({ project }) => ({
    ...project,
    image: project.heroMedia?.storageKey ? getPublicAssetUrl(project.heroMedia.storageKey) : null,
    location: project.locationLabel || [project.city, project.state].filter(Boolean).join(", "),
  }));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description || undefined,
    url: getAbsoluteUrl(`/services/${service.slug}`),
    provider: { "@id": getAbsoluteUrl("/#business") },
    areaServed: { "@type": "AdministrativeArea", name: settings.serviceArea },
  };

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Navbar variant="solid" />
      <section className="relative overflow-hidden border-b border-white/[0.08] pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,107,43,0.17),transparent_34%)]" />
        <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.03]" />
        <div className="container-shell relative py-20 sm:py-28 lg:py-32">
          <Link href="/services" className="eyebrow text-white/35 transition hover:text-[var(--helios-orange)]">All services</Link>
          <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.7rem,8vw,8rem)] font-light leading-[0.88] tracking-[-0.06em]">{service.name}</h1>
          <p className="mt-8 max-w-3xl text-base leading-8 text-white/50 sm:text-lg">{service.description || `Professional ${service.name.toLowerCase()} created to elevate listings and strengthen real estate brands across Northern Colorado.`}</p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/inquire" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-[var(--helios-orange-hover)]">Book this service</Link>
            <Link href={`/portfolio?service=${service.slug}#${service.slug}`} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/65 transition hover:border-white/35 hover:text-white">View full portfolio</Link>
          </div>
        </div>
      </section>

      <section className="container-shell py-20 sm:py-28">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow text-[var(--helios-orange)]">Selected work</p><h2 className="mt-4 font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">Made for the listing story.</h2></div>
          <p className="text-sm text-white/30">{projects.length} featured {projects.length === 1 ? "project" : "projects"}</p>
        </div>
        {projects.length ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article key={project.id} className="group relative min-h-[28rem] overflow-hidden bg-[#111]">
                <Link href={`/portfolio/${project.slug}`} aria-label={`View ${project.title}`} className="absolute inset-0 z-10" />
                {project.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.image} alt={project.heroMedia?.altText || project.heroMedia?.originalFilename || project.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-[1.035]" />
                ) : <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(217,107,43,0.18),transparent_36%),#111]" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6"><p className="text-[0.52rem] font-semibold uppercase tracking-[0.15em] text-white/42">{project.location || "Northern Colorado"}</p><h3 className="mt-2 font-display text-3xl font-light tracking-[-0.035em]">{project.title}</h3>{project.shortDescription ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/45">{project.shortDescription}</p> : null}</div>
              </article>
            ))}
          </div>
        ) : <div className="mt-10 border border-white/[0.08] bg-[#111] p-10 text-white/40">New {service.name.toLowerCase()} work is being prepared for the portfolio.</div>}
      </section>
      <ManagedCtaSection slot="SERVICES_FOOTER" fallback={defaultPageCtas.SERVICES_FOOTER} />
      <Footer />
    </main>
  );
}
