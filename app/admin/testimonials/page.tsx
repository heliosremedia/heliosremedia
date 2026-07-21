import { prisma } from "@/lib/prisma";
import { isGoogleReviewsConfigured } from "@/lib/google-business-reviews";

import TestimonialManager, { type AdminTestimonial } from "./TestimonialManager";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const testimonials = await prisma.testimonial.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  const serialized: AdminTestimonial[] = testimonials.map((testimonial) => ({
    ...testimonial,
    reviewedAt: testimonial.reviewedAt?.toISOString() ?? null,
    createdAt: testimonial.createdAt.toISOString(),
    updatedAt: testimonial.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">Client trust</p>
          <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Testimonial management</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Manage agent portraits, attribution, brokerage details, review copy, homepage visibility, and presentation order.</p>
        </div>
        <p className="max-w-xs text-xs leading-5 text-white/25 sm:text-right">Published testimonials are reusable content assets for the homepage, service pages, campaigns, and future landing pages.</p>
      </section>
      <TestimonialManager initialTestimonials={serialized} googleConfigured={isGoogleReviewsConfigured()} />
    </div>
  );
}
