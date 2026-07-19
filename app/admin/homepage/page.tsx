import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getSiteSettings } from "@/lib/site-settings";
import SiteSettingsForm from "../settings/SiteSettingsForm";
import HomepageProjectManager, { type Placement, type ProjectOption } from "./HomepageProjectManager";
import HomepageWorkCardManager, { type FilmOption, type ServiceOption, type WorkCard } from "./HomepageWorkCardManager";

export const dynamic = "force-dynamic";

export default async function HomepageCurationPage() {
  const [placements, projects, workCards, services, films, settings] = await Promise.all([
    prisma.homepageProject.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true, projectId: true, titleOverride: true, displayOrder: true, active: true, project: { select: { title: true, slug: true, status: true, locationLabel: true, heroMedia: { select: { storageKey: true, altText: true } } } } } }),
    prisma.project.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { id: true, title: true, slug: true } }),
    prisma.homepageWorkCard.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true, serviceId: true, titleOverride: true, destinationOverride: true, displayOrder: true, active: true, imageStorageKey: true, imageUrl: true, imageAlt: true, mediaMode: true, featuredMediaId: true, videoStorageKey: true, videoUrl: true, service: { select: { id: true, name: true, slug: true, active: true } }, featuredMedia: { select: { id: true, caption: true, originalFilename: true, provider: true, externalId: true, externalUrl: true, sourceType: true, project: { select: { title: true } } } } } }),
    prisma.service.findMany({ where: { active: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } }),
    prisma.media.findMany({ where: { visibility: "VISIBLE", sourceType: { in: ["UPLOADED_VIDEO", "VIDEO_EMBED"] }, project: { status: "PUBLISHED" } }, orderBy: [{ project: { title: "asc" } }, { displayOrder: "asc" }], select: { id: true, caption: true, originalFilename: true, provider: true, project: { select: { title: true } } } }),
    getSiteSettings(),
  ]);
  const serialized: Placement[] = placements.map((item) => ({ ...item, imageUrl: item.project.heroMedia?.storageKey ? getPublicAssetUrl(item.project.heroMedia.storageKey) : null }));
  const filmOptions: FilmOption[] = films.map((film) => ({ id: film.id, label: film.caption || film.originalFilename || film.project.title, provider: film.provider || "Hosted" }));
  return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Public presentation</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Homepage curation</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Control the homepage hero, supporting imagery, optional Featured Project, and the five service cards in Our Work.</p></section><SiteSettingsForm initialSettings={settings} mode="homepage" /><section><div className="mb-5"><p className="eyebrow text-[var(--helios-orange)]">Optional lead feature</p><h2 className="mt-2 text-2xl font-light text-white">Featured Project hero</h2><p className="mt-3 text-sm text-white/38">Select one published project to lead the section. The five service cards remain visible beneath it.</p></div><HomepageProjectManager initialPlacements={serialized} projects={projects as ProjectOption[]} /></section><HomepageWorkCardManager initialCards={workCards as WorkCard[]} services={services as ServiceOption[]} films={filmOptions} /></div>;
}
