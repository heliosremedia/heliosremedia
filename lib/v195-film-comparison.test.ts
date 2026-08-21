import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V1.9.5 stores offerings and classifications as tenant-aware relationships", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260812140000_v195_film_comparison/migration.sql");
  assert.match(schema, /model VideoOffering[\s\S]*workspaceId[\s\S]*offeringGroup/);
  assert.match(schema, /model VideoComparisonPlacement[\s\S]*mediaId\s+String\s+@unique/);
  assert.match(migration, /one_featured_per_offering/);
  for (const name of ["Premier Lifestyle Film", "Signature Film", "Showcase Film", "Premium Social Listing Reel", "Social Listing Reel"]) assert.match(migration, new RegExp(name));
});

test("public comparison remains curated, scoped, playable, and discoverable", () => {
  const page = read("app/films/page.tsx");
  const player = read("app/films/FilmOfferingCard.tsx");
  const styles = read("app/globals.css");
  const sitemap = read("app/sitemap.ts");
  assert.match(page, /workspaceId, status: "PUBLISHED"/);
  assert.match(page, /featuredExample: "desc"/);
  assert.match(page, /offeringGroup === "CINEMATIC_FILM"/);
  assert.match(player, /preload="metadata"/);
  assert.doesNotMatch(player, /autoPlay/);
  assert.match(player, /aria-live="polite"/);
  assert.match(player, /film-example-selector public-btn public-btn-compact/);
  assert.doesNotMatch(player, /text-\[\.55rem\]/);
  assert.match(styles, /button\.film-example-selector[\s\S]*--public-button-font-size/);
  assert.match(sitemap, /absolute\("\/films"\)/);
});

test("newsletter performance shortcut preserves the existing analytics panel", () => {
  const editor = read("app/admin/newsletter-studio/components/EditionEditor.tsx");
  const analytics = read("app/admin/newsletter-studio/components/NewsletterAnalytics.tsx");
  assert.match(editor, /View Performance/);
  assert.match(editor, /prefers-reduced-motion: reduce/);
  assert.match(analytics, /id="newsletter-performance"/);
  assert.match(analytics, /tabIndex=\{-1\}/);
});

test("V1.9.5 is planned until production approval", () => {
  assert.match(read("lib/version.ts"), /STUDIO_VERSION = "V1\.9\.5"/);
  assert.match(read("lib/releases.ts"), /version: "V1\.9\.5"[\s\S]*status: "PLANNED"/);
});
