import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getSiteSettings } from "@/lib/site-settings";
import { requireAdminSession } from "@/lib/auth/session";
import { normalizeHomepageCurationPreferences } from "@/lib/homepage-curation-layout";
import SiteSettingsForm from "../settings/SiteSettingsForm";
import HomepageProjectManager, { type Placement, type ProjectOption } from "./HomepageProjectManager";
import HomepageWorkCardManager, { type FilmOption, type ServiceOption, type WorkCard } from "./HomepageWorkCardManager";
import HomepageStructureManager from "./HomepageStructureManager";
import HomepageCurationOrganizer from "./HomepageCurationOrganizer";

export const dynamic = "force-dynamic";

export default async function HomepageCurationPage() {
  const session = await requireAdminSession();
  const [placements, projects, workCards, services, films, settings, user] = await Promise.all([
    prisma.homepageProject.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true, projectId: true, titleOverride: true, displayOrder: true, active: true, project: { select: { title: true, slug: true, status: true, locationLabel: true, heroMedia: { select: { storageKey: true, altText: true } } } } } }),
    prisma.project.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { id: true, title: true, slug: true } }),
    prisma.homepageWorkCard.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true, serviceId: true, titleOverride: true, destinationOverride: true, displayOrder: true, active: true, imageStorageKey: true, imageUrl: true, imageAlt: true, mediaMode: true, featuredMediaId: true, videoStorageKey: true, videoUrl: true, service: { select: { id: true, name: true, slug: true, active: true } }, featuredMedia: { select: { id: true, caption: true, originalFilename: true, provider: true, externalId: true, externalUrl: true, sourceType: true, project: { select: { title: true } } } } } }),
    prisma.service.findMany({ where: { active: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } }),
    prisma.media.findMany({ where: { visibility: "VISIBLE", sourceType: { in: ["UPLOADED_VIDEO", "VIDEO_EMBED"] }, project: { status: "PUBLISHED" } }, orderBy: [{ project: { title: "asc" } }, { displayOrder: "asc" }], select: { id: true, caption: true, originalFilename: true, provider: true, project: { select: { title: true } } } }),
    getSiteSettings(),
    prisma.adminUser.findFirst({
      where: { id: session.userId, workspaceId: session.workspaceId },
      select: { homepageCurationPreferences: true },
    }),
  ]);
  const serialized: Placement[] = placements.map((item) => ({ ...item, imageUrl: item.project.heroMedia?.storageKey ? getPublicAssetUrl(item.project.heroMedia.storageKey) : null }));
  const filmOptions: FilmOption[] = films.map((film) => ({ id: film.id, label: film.caption || film.originalFilename || film.project.title, provider: film.provider || "Hosted" }));
  const navigation = [...settings.headerNavigation, ...settings.footerNavigation];
  const uniqueLinks = new Set(navigation.map((item) => item.href.toLowerCase()));
  const navCount = settings.headerNavigation.filter((item) => item.displayInNav ?? item.published !== false).length;
  const footerCount = settings.footerNavigation.filter((item) => item.displayInFooter ?? item.published !== false).length;
  return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Public presentation</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Homepage curation</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Control homepage content while arranging this admin workspace to match your workflow. Layout changes are private and never affect the public page order.</p></section>
    <HomepageCurationOrganizer
      initialPreferences={normalizeHomepageCurationPreferences(user?.homepageCurationPreferences)}
      sections={[
        {
          id: "homepage-navigation",
          title: "Navigation Links",
          description: "Manage labels, destinations, placement, new-tab behavior, and public navigation order.",
          summary: `${uniqueLinks.size} total · ${navCount} navigation · ${footerCount} footer`,
          content: <HomepageStructureManager initialSettings={settings} mode="navigation" />,
        },
        {
          id: "homepage-media",
          title: "Homepage Media",
          description: "Hero media, public availability, homepage copy, and supporting imagery.",
          content: <SiteSettingsForm initialSettings={settings} mode="homepage" />,
        },
        {
          id: "featured-project",
          title: "Featured Project",
          description: "Select one published project to lead the section. The five service cards remain visible beneath it.",
          summary: placements.length ? "Featured Project configured" : "No Featured Project selected",
          content: <HomepageProjectManager initialPlacements={serialized} projects={projects as ProjectOption[]} />,
        },
        {
          id: "our-work",
          title: "Our Work",
          description: "Choose the five service cards, imagery, destinations, and card media used in the public Our Work collection.",
          summary: `${workCards.length}/5 cards configured`,
          content: <HomepageWorkCardManager initialCards={workCards as WorkCard[]} services={services as ServiceOption[]} films={filmOptions} />,
        },
        {
          id: "homepage-structure",
          title: "Reusable Structure",
          description: "Manage the reusable Our Standard and Our Approach content cards.",
          summary: `${settings.standardPrinciples.length + settings.approachCards.length} reusable cards configured`,
          content: <HomepageStructureManager initialSettings={settings} mode="structure" />,
        },
      ]}
    />
  </div>;
}
