import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { locationFieldError, normalizeAiDraft, splitParagraphs } from "./location-page-content.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("Market Story paragraphs and exact 1,400-character boundary are preserved", () => {
  assert.deepEqual(splitParagraphs("First paragraph.\n\nSecond paragraph."), ["First paragraph.", "Second paragraph."]);
  assert.deepEqual(splitParagraphs("First paragraph.\nSecond paragraph."), ["First paragraph.", "Second paragraph."]);
  assert.equal(locationFieldError("marketCopy", "x".repeat(1400)), null);
  assert.match(locationFieldError("marketCopy", "x".repeat(1401)) || "", /1,400/);
});

test("AI drafts are safely fitted to field limits and Helios punctuation", () => {
  const normalized = normalizeAiDraft({
    marketCopy: `${"A locally specific sentence. ".repeat(80)}Final sentence.`,
    heroLead: "Calm craft — grounded in place.",
  }, false);
  assert.ok((normalized.marketCopy?.length || 0) <= 1400);
  assert.match(normalized.marketCopy || "", /[.!?]$/);
  assert.equal(normalized.heroLead, "Calm craft, grounded in place.");
  assert.deepEqual(normalizeAiDraft({ marketCopy: "A specific, reviewable story." }, false), { marketCopy: "A specific, reviewable story." });
});

test("Location Page AI uses a complete strict schema and compatible fallback", () => {
  const ai = read("app/api/admin/locations/ai/route.ts");
  assert.match(ai, /type: "json_schema"/);
  assert.match(ai, /strict: true/);
  assert.match(ai, /additionalProperties: false/);
  assert.match(ai, /required: \["heroLead", "introduction", "marketTitle", "marketCopy", "ctaHeadline", "seoTitle", "seoDescription", "featureImageAlt"\]/);
  assert.match(ai, /\[configuredModel, "gpt-5-mini"\]/);
  assert.match(ai, /customDirection: customDirection \|\| null/);
  assert.match(ai, /treat every requested subject as a firm creative requirement/i);
  assert.match(ai, /stable, widely known geographic, cultural, historical/i);
  assert.match(ai, /Market Story must be 900 to 1,400 characters/);
  assert.match(ai, /draftQualityIssues\(draft, location\.city, customDirection\)/);
  assert.match(ai, /qualityFeedback: qualityFeedback\.length \? qualityFeedback : null/);
  assert.match(ai, /max_output_tokens: 6_000/);
  assert.match(ai, /fail the city-swap test/i);
  assert.doesNotMatch(ai, /Treat customDirection as optional guidance/);
  assert.doesNotMatch(ai, /text: \{ format: \{ type: "json_object" \} \}/);
});

test("Location Page revamp preserves review, image, tenant, and SEO boundaries", () => {
  const manager = read("app/admin/locations/LocationPageManager.tsx");
  const ai = read("app/api/admin/locations/ai/route.ts");
  const route = read("app/api/admin/locations/route.ts");
  const page = read("app/locations/[city]/page.tsx");
  const migration = read("prisma/migrations/20260804153000_revamp_location_pages/migration.sql");
  assert.match(manager, /collapsed|Open assistant/i);
  assert.match(manager, /Apply complete draft/);
  assert.match(manager, /Apply field/);
  assert.match(manager, /Save draft/);
  assert.match(manager, /Replace image/);
  assert.match(manager, /Horizontal focal point/);
  assert.match(ai, /workspaceId: session\.workspaceId/);
  assert.match(ai, /active: true, archivedAt: null/);
  assert.match(route, /FIELD_TOO_LONG/);
  assert.match(page, /splitParagraphs\(location\.marketCopy\)/);
  assert.match(page, /scroll-mt-40/);
  assert.match(page, /buildPageMetadata/);
  assert.doesNotMatch(migration, /UPDATE "LocationPage"\s+SET "marketCopy"/);
});
