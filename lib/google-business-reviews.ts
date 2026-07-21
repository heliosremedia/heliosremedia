import "server-only";

import { prisma } from "@/lib/prisma";
import { TESTIMONIAL_CHARACTER_LIMIT } from "@/lib/testimonials";

type GoogleReview = {
  reviewId?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime?: string;
  updateTime?: string;
};

const ratings = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as const;

function configuration() {
  const values = {
    clientId: process.env.GOOGLE_BUSINESS_CLIENT_ID,
    clientSecret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_BUSINESS_REFRESH_TOKEN,
    accountId: process.env.GOOGLE_BUSINESS_ACCOUNT_ID,
    locationId: process.env.GOOGLE_BUSINESS_LOCATION_ID,
  };
  return Object.values(values).every(Boolean) ? values as Record<keyof typeof values, string> : null;
}

export function isGoogleReviewsConfigured() { return configuration() !== null; }

async function accessToken(config: NonNullable<ReturnType<typeof configuration>>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google authorization failed (${response.status}).`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Google did not return an access token.");
  return data.access_token;
}

export async function syncGoogleBusinessReviews() {
  const config = configuration();
  if (!config) throw new Error("Google Business Profile is not connected.");
  const token = await accessToken(config);
  const reviews: GoogleReview[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(config.accountId)}/locations/${encodeURIComponent(config.locationId)}/reviews`);
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`Google review sync failed (${response.status}).`);
    const data = await response.json() as { reviews?: GoogleReview[]; nextPageToken?: string };
    reviews.push(...(data.reviews ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  let imported = 0;
  let updated = 0;
  for (const review of reviews) {
    if (!review.reviewId || !review.comment?.trim()) continue;
    const existing = await prisma.testimonial.findUnique({ where: { externalReviewId: review.reviewId }, select: { id: true } });
    const text = review.comment.trim().slice(0, TESTIMONIAL_CHARACTER_LIMIT);
    const data = {
      agentName: review.reviewer?.displayName?.trim() || "Google reviewer",
      testimonial: text,
      rating: review.starRating ? ratings[review.starRating] : 5,
      sourceProvider: "GOOGLE",
      reviewerPhotoUrl: review.reviewer?.profilePhotoUrl || null,
      reviewedAt: review.createTime ? new Date(review.createTime) : null,
      sourceUrl: process.env.GOOGLE_BUSINESS_REVIEWS_URL || null,
    };
    if (existing) { await prisma.testimonial.update({ where: { id: existing.id }, data }); updated += 1; }
    else {
      const order = await prisma.testimonial.aggregate({ _max: { displayOrder: true } });
      await prisma.testimonial.create({ data: { ...data, externalReviewId: review.reviewId, displayOrder: (order._max.displayOrder ?? -1) + 1, published: false, featured: false } });
      imported += 1;
    }
  }
  return { received: reviews.length, imported, updated };
}
