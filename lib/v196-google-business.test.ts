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
