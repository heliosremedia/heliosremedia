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

test("AI drafts reject over-limit fields and em dashes", () => {
  assert.throws(() => normalizeAiDraft({ marketCopy: "x".repeat(1401) }, false), /INVALID_AI_DRAFT/);
  assert.throws(() => normalizeAiDraft({ marketCopy: "A generic — claim" }, false), /INVALID_AI_DRAFT/);
  assert.deepEqual(normalizeAiDraft({ marketCopy: "A specific, reviewable story." }, false), { marketCopy: "A specific, reviewable story." });
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
