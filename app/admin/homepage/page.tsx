import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import HomepageProjectManager, { type Placement, type ProjectOption } from "./HomepageProjectManager";
import HomepageFilmManager from "./HomepageFilmManager";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function HomepageCurationPage() {
  const [placements, projects, settings] = await Promise.all([
    prisma.homepageProject.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true, projectId: true, titleOverride: true, displayOrder: true, active: true, project: { select: { title: true, slug: true, status: true, locationLabel: true, heroMedia: { select: { storageKey: true, altText: true } } } } } }),
    prisma.project.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { id: true, title: true, slug: true } }),
    getSiteSettings(),
  ]);
  const serialized: Placement[] = placements.map((item) => ({ ...item, imageUrl: item.project.heroMedia?.storageKey ? getPublicAssetUrl(item.project.heroMedia.storageKey) : null }));
  return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Public presentation</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Homepage curation</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Control the featured cinematic card and choose up to five published projects for the supporting homepage collection.</p></section><HomepageFilmManager initialSettings={{ featuredFilmEnabled: settings.featuredFilmEnabled, featuredFilmVideoStorageKey: settings.featuredFilmVideoStorageKey, featuredFilmVideoUrl: settings.featuredFilmVideoUrl, featuredFilmPosterStorageKey: settings.featuredFilmPosterStorageKey, featuredFilmPosterUrl: settings.featuredFilmPosterUrl, featuredFilmDestination: settings.featuredFilmDestination }} /><HomepageProjectManager initialPlacements={serialized} projects={projects as ProjectOption[]} /></div>;
}
