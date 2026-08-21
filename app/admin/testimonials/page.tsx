import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth/session";
import { getGoogleBusinessAdminState } from "@/lib/google-business-admin";

import TestimonialManager, { type AdminTestimonial } from "./TestimonialManager";
import GoogleBusinessConnectionPanel, { type GoogleConnectionState, type GoogleLocationOption } from "./GoogleBusinessConnectionPanel";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const session = await requireAdminSession();
  const [testimonials, googleState, query] = await Promise.all([prisma.testimonial.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  }), getGoogleBusinessAdminState(session), searchParams]);

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
      <GoogleBusinessConnectionPanel initialState={{ ...googleState, connection: googleState.connection ? { ...googleState.connection, availableLocations: Array.isArray(googleState.connection.availableLocations) ? googleState.connection.availableLocations as GoogleLocationOption[] : [], lastSyncAt: googleState.connection.lastSyncAt?.toISOString() ?? null, connectedAt: googleState.connection.connectedAt?.toISOString() ?? null } : null, reviews: googleState.reviews.map((review) => ({ ...review, reviewCreatedAt: review.reviewCreatedAt?.toISOString() ?? null, reviewUpdatedAt: review.reviewUpdatedAt?.toISOString() ?? null, lastSyncedAt: review.lastSyncedAt.toISOString() })) } as GoogleConnectionState} callbackMessage={callbackMessage(query.google)} />
      <TestimonialManager initialTestimonials={serialized} importedGoogleReviewCount={googleState.importedReviewCount} />
    </div>
  );
}

function callbackMessage(value?: string) {
  const messages: Record<string, string> = { connected: "Google Business Profile connected.", choose_location: "Google authorization completed. Select the company location to finish connecting.", denied: "Google authorization was canceled. No connection was saved.", invalid_state: "The Google authorization request expired or could not be validated. Start again.", connection_failed: "Google authorization could not be completed. No connected status was saved.", no_locations: "Google authorized access, but no manageable Business Profile location was found." };
  return value ? messages[value] : undefined;
}
