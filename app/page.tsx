import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HeliosStandard from "./components/HeliosStandard";
import WorkShowcase from "./components/work/WorkShowcase";
import OurApproach from "./components/OurApproach";
import TrustedBy from "./components/TrustedBy";
import InTheirWords from "./components/InTheirWords";
import PrimaryConversion from "./components/PrimaryConversion";
import Footer from "./components/Footer";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { defaultHomeCta, getCtaForSlot } from "@/lib/ctas";
import { getSiteSettings } from "@/lib/site-settings";
import { getHomepageCardVideo } from "@/lib/homepage-work-cards";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [testimonials, trustedLogos, homepageProjects, homepageWorkCards, homepageCta, settings] = await Promise.all([
    prisma.testimonial.findMany({
      where: { published: true, featured: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, agentName: true, jobTitle: true, brokerage: true,
        testimonial: true, photoUrl: true, photoAlt: true, focalX: true,
        focalY: true, rating: true, sourceUrl: true,
      },
    }),
    prisma.trustedLogo.findMany({
      where: { published: true, logoUrl: { not: null } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, organizationName: true, logoUrl: true, logoAlt: true, websiteUrl: true, monochrome: true, displayColor: true, displayOpacity: true, displayScale: true },
    }),
    prisma.homepageProject.findMany({
      where: { active: true, project: { status: "PUBLISHED" } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      take: 1,
      select: { titleOverride: true, project: { select: { title: true, slug: true, heroMedia: { select: { storageKey: true, altText: true } } } } },
    }),
    prisma.homepageWorkCard.findMany({
      where: { active: true, service: { active: true } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      take: 5,
      select: {
        titleOverride: true, destinationOverride: true, imageUrl: true, imageAlt: true,
        mediaMode: true, videoUrl: true,
        service: { select: { name: true, slug: true } },
        featuredMedia: { select: { sourceType: true, provider: true, storageKey: true, externalUrl: true, externalId: true, project: { select: { status: true } } } },
      },
    }),
    getCtaForSlot("HOME_PRIMARY"),
    getSiteSettings(),
  ]);
  const featuredProject = homepageProjects
    .filter((item) => item.project.heroMedia?.storageKey)
    .map((item) => ({
      title: item.titleOverride || item.project.title,
      href: `/portfolio/${item.project.slug}`,
      image: getPublicAssetUrl(item.project.heroMedia!.storageKey!),
      imageAlt: item.project.heroMedia?.altText || item.project.title,
      size: "hero" as const,
    }))[0] ?? null;
  const configuredWorkItems = homepageWorkCards
    .filter((card) => !card.featuredMedia || card.featuredMedia.project.status === "PUBLISHED")
    .map((card, index) => {
      const video = getHomepageCardVideo(card);
      return {
        title: card.titleOverride || card.service.name,
        href: card.destinationOverride || `/portfolio?service=${card.service.slug}`,
        image: card.imageUrl || video.thumbnailUrl || "/work/cards/cinematicfilms-workcard.jpg",
        imageAlt: card.imageAlt || `${card.service.name} by Helios Real Estate Media`,
        size: index === 0 ? ("hero" as const) : ("supporting" as const),
        videoSrc: video.videoSrc,
        embedSrc: video.embedSrc,
      };
    });

  return (
    <main>
      <Navbar />
      <Hero settings={settings} />
      <HeliosStandard
        imageUrl={settings.heliosStandardImageUrl}
        imageAlt={settings.heliosStandardImageAlt}
        eyebrow={settings.standardEyebrow}
        headingLineOne={settings.standardHeadingLineOne}
        headingLineTwo={settings.standardHeadingLineTwo}
        body={settings.standardBody}
      />
      <WorkShowcase
        settings={settings}
        items={configuredWorkItems.length > 0 ? configuredWorkItems : undefined}
        featuredProject={featuredProject}
        featuredFilm={{ enabled: configuredWorkItems.length === 0 && settings.featuredFilmEnabled, videoSrc: settings.featuredFilmVideoUrl, poster: settings.featuredFilmPosterUrl, href: settings.featuredFilmDestination }}
      />
      <OurApproach settings={settings} />
      <TrustedBy logos={trustedLogos.map((logo) => ({
        id: logo.id,
        organizationName: logo.organizationName,
        src: logo.logoUrl!,
        alt: logo.logoAlt || logo.organizationName,
        websiteUrl: logo.websiteUrl,
        monochrome: logo.monochrome,
        displayColor: logo.displayColor,
        displayOpacity: logo.displayOpacity,
        displayScale: logo.displayScale,
      }))} />
      <InTheirWords testimonials={testimonials.map((item) => ({
        id: item.id,
        quote: item.testimonial,
        name: item.agentName,
        jobTitle: item.jobTitle,
        brokerage: item.brokerage,
        image: item.photoUrl,
        imageAlt: item.photoAlt || item.agentName,
        focalX: item.focalX,
        focalY: item.focalY,
        rating: item.rating,
        sourceUrl: item.sourceUrl,
      }))} />
      <PrimaryConversion cta={homepageCta ?? defaultHomeCta} imageUrl={settings.primaryConversionImageUrl} imageAlt={settings.primaryConversionImageAlt} imageCaption={settings.conversionImageCaption} />
      <Footer />
    </main>
  );
}
