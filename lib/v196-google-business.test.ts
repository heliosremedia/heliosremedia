import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("V1.9.6 publishes the exact OAuth application identity and review-before-publish explanation", () => {
  const page = read("app/google-business-integration/page.tsx");
  assert.match(page, /Helios Studio[\s\S]*Google Reviews/);
  assert.match(page, /not automatically published/i);
  assert.match(page, /\/privacy/);
  assert.match(page, /\/terms/);
});

test("Google OAuth uses one scope, PKCE, state hashing, offline access, and server-only credentials", () => {
  const start = read("app/api/admin/integrations/google-business/start/route.ts");
  const crypto = read("lib/google-business-crypto.ts");
  assert.match(start, /GOOGLE_BUSINESS_SCOPE/);
  assert.match(start, /access_type[\s\S]*offline/);
  assert.match(start, /code_challenge_method[\s\S]*S256/);
  assert.match(start, /hashOAuthState/);
  assert.match(crypto, /aes-256-gcm/);
  assert.doesNotMatch(start, /refreshToken/);
});

test("connections and imported reviews are workspace-scoped and idempotent", () => {
  const schema = read("prisma/schema.prisma");
  const sync = read("lib/google-business-reviews.ts");
  assert.match(schema, /model GoogleBusinessConnection[\s\S]*workspaceId String\s+@unique/);
  assert.match(schema, /model GoogleBusinessReview[\s\S]*@@unique\(\[connectionId, googleReviewId\]\)/);
  assert.match(sync, /googleBusinessReview\.upsert/);
  assert.match(sync, /workspaceId/);
});

test("manual curation creates an unpublished and unfeatured testimonial without overwriting curated fields", () => {
  const curate = read("app/api/admin/integrations/google-business/reviews/[reviewId]/curate/route.ts");
  const sync = read("lib/google-business-reviews.ts");
  assert.match(curate, /published: false, featured: false/);
  assert.doesNotMatch(sync, /testimonial\.update/);
});

test("scheduled Google synchronization is disabled during the initial OAuth phase", () => {
  assert.doesNotMatch(read("vercel.json"), /api\/cron\/google-reviews/);
  assert.match(read("app/api/cron/google-reviews/route.ts"), /scheduledSyncEnabled: false/);
});

test("Google review source records can be collapsed above manual testimonials", () => {
  const panel = read("app/admin/testimonials/GoogleBusinessConnectionPanel.tsx");
  const manager = read("app/admin/testimonials/TestimonialManager.tsx");
  const page = read("app/admin/testimonials/page.tsx");
  const adminState = read("lib/google-business-admin.ts");
  assert.match(panel, /aria-expanded=\{expanded\}/);
  assert.match(panel, /aria-controls="google-business-details"/);
  assert.match(panel, /hidden=\{!expanded\}/);
  assert.match(panel, /imported review/);
  assert.match(panel, /history\.replaceState/);
  assert.match(panel, /scrollTo\(\{ top: 0/);
  assert.match(manager, /Imported Google/);
  assert.match(manager, /importedGoogleReviewCount/);
  assert.match(page, /importedGoogleReviewCount=\{googleState\.importedReviewCount\}/);
  assert.match(adminState, /googleBusinessReview\.count/);
  assert.match(panel, /state\.importedReviewCount/);
});

test("homepage shows the newest 20 uncurated Google reviews and links to the full library", () => {
  const homepage = read("app/page.tsx");
  const words = read("app/components/InTheirWords.tsx");
  assert.match(homepage, /googleBusinessReview\.findMany/);
  assert.match(homepage, /testimonialId: null/);
  assert.match(homepage, /take: 20/);
  assert.match(words, /href="\/reviews"/);
  assert.match(words, /See all Google reviews/);
  assert.match(words, /google-review-ribbon_240s_linear_infinite/);
});

test("public reviews page lists current Google reviews and is included in the sitemap", () => {
  const page = read("app/reviews/page.tsx");
  const sitemap = read("app/sitemap.ts");
  assert.match(page, /syncStatus: "CURRENT"/);
  assert.match(page, /googleBusinessReview\.findMany/);
  assert.match(page, /View Helios on Google/);
  assert.match(page, /py-14 sm:py-16 lg:py-20/);
  assert.match(page, /<section className="relative overflow-hidden border-b border-white\/\[0\.07\]">/);
  assert.match(sitemap, /absolute\("\/reviews"\)/);
});
