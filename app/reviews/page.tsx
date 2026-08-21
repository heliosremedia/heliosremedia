import type { Metadata } from "next";
import Link from "next/link";

import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { prisma } from "@/lib/prisma";
import { getPublicWorkspaceId } from "@/lib/public-workspace";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { displayTestimonial } from "@/lib/testimonials";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return buildPageMetadata({ title: "Google Reviews | Helios Real Estate Media", description: "Read verified Google reviews from real estate professionals who trust Helios Real Estate Media for photography, cinematic films, and listing media.", path: "/reviews", settings });
}

export default async function ReviewsPage() {
  const [workspaceId, settings] = await Promise.all([getPublicWorkspaceId(), getSiteSettings()]);
  const reviews = await prisma.googleBusinessReview.findMany({
    where: { workspaceId, reviewText: { not: null }, syncStatus: "CURRENT" },
    orderBy: [{ reviewUpdatedAt: "desc" }, { reviewCreatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, reviewerName: true, reviewText: true, starRating: true, reviewCreatedAt: true },
  });
  const googleUrl = process.env.GOOGLE_BUSINESS_REVIEWS_URL || null;

  return <main className="min-h-screen bg-[#080808] text-white">
    <Navbar variant="solid" />
    <section className="relative overflow-hidden border-b border-white/[0.07] pt-20 sm:pt-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,107,43,0.13),transparent_34%)]" />
      <div className="container-shell relative py-14 sm:py-16 lg:py-20">
        <p className="eyebrow text-[var(--helios-orange)]">Client experiences</p>
        <h1 className="mt-6 max-w-5xl font-display text-[clamp(3rem,7.2vw,6.5rem)] font-light leading-[0.9] tracking-[-0.055em]">Trust, in their<br /><span className="italic text-white/52">own words.</span></h1>
        <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center"><p className="max-w-2xl text-base leading-8 text-white/48 sm:text-lg">Verified Google reviews from the agents and teams who trust Helios to bring their listings to life.</p><p className="shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/35">{reviews.length} written review{reviews.length === 1 ? "" : "s"}</p></div>
      </div>
    </section>

    <section className="container-shell py-16 sm:py-20 lg:py-24" aria-label="Google reviews">
      {reviews.length > 0 ? <div className="columns-1 gap-5 md:columns-2 xl:columns-3">{reviews.map((review) => <article key={review.id} className="mb-5 break-inside-avoid rounded-2xl border border-white/[0.08] bg-white/[0.022] p-6 sm:p-7"><div className="flex items-center justify-between gap-5"><span className="text-[0.52rem] font-semibold uppercase tracking-[0.19em] text-white/35">Google review</span><span aria-label={`${review.starRating} out of 5 stars`} className="text-[0.62rem] tracking-[0.14em] text-[var(--helios-orange)]">{"★".repeat(review.starRating)}<span className="text-white/15">{"★".repeat(5 - review.starRating)}</span></span></div><blockquote className="mt-5 font-display text-[1.35rem] leading-7 text-white/68">“{displayTestimonial(review.reviewText!)}”</blockquote><div className="mt-6 border-t border-white/[0.07] pt-5"><p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white/52">{review.reviewerName}</p>{review.reviewCreatedAt && <p className="mt-2 text-[0.55rem] uppercase tracking-[0.14em] text-white/24">{review.reviewCreatedAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>}</div></article>)}</div> : <div className="rounded-2xl border border-white/[0.08] py-24 text-center"><p className="font-display text-4xl font-light text-white/40">Reviews are being synchronized.</p></div>}

      <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-white/[0.08] pt-10 sm:flex-row"><Link href="/#testimonials" className="public-btn public-btn-compact min-h-11 justify-center">Back to Featured Reviews</Link>{googleUrl && <a href={googleUrl} target="_blank" rel="noreferrer" className="public-btn public-btn-compact min-h-11 justify-center">View Helios on Google <span aria-hidden="true">↗</span></a>}</div>
    </section>
    <Footer />
  </main>;
}
