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

export const dynamic = "force-dynamic";

export default async function Home() {
  const testimonials = await prisma.testimonial.findMany({
    where: { published: true, featured: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      agentName: true,
      jobTitle: true,
      brokerage: true,
      testimonial: true,
      photoUrl: true,
      photoAlt: true,
      focalX: true,
      focalY: true,
      rating: true,
      sourceUrl: true,
    },
  });

  return (
    <main>
      <Navbar />
      <Hero />
      <HeliosStandard />
      <WorkShowcase />
      <OurApproach />
      <TrustedBy />
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
