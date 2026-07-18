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

export const dynamic = "force-dynamic";

export default async function Home() {
  const [testimonials, trustedLogos, homepageProjects] = await Promise.all([
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
      take: 5,
      select: { titleOverride: true, project: { select: { title: true, slug: true, heroMedia: { select: { storageKey: true, altText: true } } } } },
    }),
  ]);
  const curatedWorkItems = homepageProjects
    .filter((item) => item.project.heroMedia?.storageKey)
    .map((item, index) => ({
      title: item.titleOverride || item.project.title,
      href: `/portfolio/${item.project.slug}`,
      image: getPublicAssetUrl(item.project.heroMedia!.storageKey!),
      imageAlt: item.project.heroMedia?.altText || item.project.title,
      size: index === 0 ? ("hero" as const) : ("supporting" as const),
    }));

  return (
    <main>
      <Navbar />
      <Hero />
      <HeliosStandard />
      <WorkShowcase items={curatedWorkItems.length > 0 ? curatedWorkItems : undefined} />
      <OurApproach />
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
      <PrimaryConversion />
      <Footer />
    </main>
  );
}
