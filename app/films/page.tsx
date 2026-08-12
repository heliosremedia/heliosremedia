import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { tryResolveExternalMedia } from "@/lib/external-media";
import { prisma } from "@/lib/prisma";
import { getPublicWorkspaceId } from "@/lib/public-workspace";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import FilmOfferingCard, { type FilmOfferingView } from "./FilmOfferingCard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return buildPageMetadata({
    title: "Compare Cinematic Films and Social Reels | Helios",
    description:
      "Watch curated Helios film examples and compare cinematic property films with purpose-built social listing reels.",
    path: "/films",
    settings,
  });
}

async function getOfferings(): Promise<FilmOfferingView[]> {
  const workspaceId = await getPublicWorkspaceId();
  const offerings = await prisma.videoOffering.findMany({
    where: { workspaceId, active: true },
    orderBy: [{ offeringGroup: "asc" }, { comparisonOrder: "asc" }],
    include: {
      placements: {
        where: {
          showOnComparison: true,
          media: {
            visibility: "VISIBLE",
            sourceType: { in: ["VIDEO_EMBED", "UPLOADED_VIDEO"] },
            project: { workspaceId, status: "PUBLISHED" },
          },
        },
        orderBy: [
          { featuredExample: "desc" },
          { comparisonOrder: "asc" },
          { createdAt: "asc" },
        ],
        include: {
          media: {
            select: {
              id: true,
              originalFilename: true,
              externalUrl: true,
              width: true,
              height: true,
            },
          },
        },
      },
    },
  });
  return offerings.map((offering) => ({
    id: offering.id,
    offeringGroup: offering.offeringGroup,
    publicName: offering.publicName,
    positioningStatement: offering.positioningStatement,
    publicDescription: offering.publicDescription,
    priceLabel: offering.priceLabel,
    runtimeGuidance: offering.runtimeGuidance,
    orientation: offering.orientation,
    bestForDescription: offering.bestForDescription,
    featureDistinctions: Array.isArray(offering.featureDistinctions)
      ? offering.featureDistinctions.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    bookingDestination: offering.bookingDestination || "/inquire",
    examples: offering.placements.flatMap((placement) => {
      const resolved = tryResolveExternalMedia(placement.media.externalUrl);
      if (!resolved?.embedUrl && !resolved?.playbackUrl) return [];
      return [
        {
          id: placement.media.id,
          title:
            placement.publicTitle ||
            placement.media.originalFilename ||
            offering.publicName,
          embedUrl: resolved.embedUrl,
          playbackUrl: resolved.playbackUrl,
          posterUrl: placement.posterOverrideUrl || resolved.thumbnailUrl,
          orientation:
            placement.media.height &&
            placement.media.width &&
            placement.media.height > placement.media.width
              ? "vertical"
              : offering.orientation?.toLowerCase() === "vertical"
                ? "vertical"
                : "horizontal",
        },
      ];
    }),
  }));
}

export default async function FilmsPage() {
  const offerings = await getOfferings();
  const cinematic = offerings.filter(
    (item) => item.offeringGroup === "CINEMATIC_FILM",
  );
  const reels = offerings.filter(
    (item) => item.offeringGroup === "SOCIAL_MEDIA_REEL",
  );
  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <Navbar variant="solid" />
      <section className="relative overflow-hidden border-b border-white/[.08] pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(217,107,43,.16),transparent_34%)]" />
        <div className="container-shell relative py-20 sm:py-28">
          <p className="eyebrow text-[var(--helios-orange)]">
            Helios cinematic films
          </p>
          <h1 className="mt-7 max-w-6xl font-display text-[clamp(3.2rem,8vw,7.5rem)] font-light leading-[.9] tracking-[-.055em]">
            Find the right film for the story you want to tell.
          </h1>
          <p className="mt-8 max-w-3xl text-base leading-8 text-white/48 sm:text-lg">
            Each production level offers a different degree of storytelling,
            filming, editing, and campaign value. Watch the work, compare the
            distinctions, and choose the approach that fits the listing.
          </p>
        </div>
      </section>
      <section
        id="cinematic-films"
        className="container-shell scroll-mt-28 py-20 sm:py-28"
      >
        <div className="max-w-3xl">
          <p className="eyebrow text-[var(--helios-orange)]">Cinematic Films</p>
          <h2 className="mt-5 font-display text-4xl font-light tracking-[-.04em] sm:text-6xl">
            From polished showcase to complete emotional story.
          </h2>
        </div>
        <div className="mt-12">
          {cinematic.map((offering, index) => (
            <FilmOfferingCard
              key={offering.id}
              offering={offering}
              number={String(index + 1).padStart(2, "0")}
            />
          ))}
        </div>
      </section>
      <section
        id="social-reels"
        className="scroll-mt-28 border-y border-white/[.08] bg-[#0d0d0d]"
      >
        <div className="container-shell py-20 sm:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow text-[var(--helios-orange)]">
              Social Media Reels
            </p>
            <h2 className="mt-5 font-display text-4xl font-light tracking-[-.04em] sm:text-6xl">
              Built for vertical attention.
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/45 sm:text-base">
              Social reels solve a different marketing need. Choose an efficient
              vertical conversion or a production filmed specifically for the
              social frame.
            </p>
          </div>
          <div className="mt-12">
            {reels.map((offering, index) => (
              <FilmOfferingCard
                key={offering.id}
                offering={offering}
                number={String(index + 1).padStart(2, "0")}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="container-shell py-24 text-center sm:py-32">
        <p className="eyebrow text-[var(--helios-orange)]">
          Choose with confidence
        </p>
        <h2 className="mx-auto mt-5 max-w-4xl font-display text-4xl font-light tracking-[-.04em] sm:text-6xl">
          Let’s shape the right film around the property.
        </h2>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link
            href="/inquire"
            className="inline-flex min-h-12 items-center rounded-full bg-[var(--helios-orange)] px-7 text-[.58rem] font-semibold uppercase tracking-[.16em] text-black"
          >
            Start a conversation
          </Link>
          <Link
            href="/services"
            className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-7 text-[.58rem] font-semibold uppercase tracking-[.16em] text-white/65"
          >
            Explore services
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}
