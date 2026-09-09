import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("masonry replaces the cropped grid while preserving other views and lightbox behavior", () => {
  const gallery = read("../app/portfolio/[slug]/PortfolioGallery.tsx");
  assert.match(gallery, /title="Masonry Gallery"/);
  assert.match(gallery, /columns-2 gap-2 md:columns-3 md:gap-3 xl:columns-4/);
  assert.match(gallery, /width=\{item\.width \|\| 1800\}/);
  assert.match(gallery, /height=\{item\.height \|\| 1200\}/);
  assert.match(gallery, /galleryView === "list"/);
  assert.match(gallery, /galleryView === "showcase"/);
  assert.match(gallery, /event\.key === "Escape"/);
  assert.match(gallery, /loading="lazy"/);
});

test("quick browse is independently configurable, progressive, and tenant isolated", () => {
  const settings = read("portfolio-discovery-settings.ts");
  const settingsEndpoint = read("../app/api/admin/portfolio-settings/route.ts");
  const query = read("portfolio-discovery.ts");
  const portfolio = read("../app/portfolio/page.tsx");
  const photos = read("../app/portfolio/gallery/PhotographyBrowser.tsx");
  const films = read("../app/portfolio/films/FilmsBrowser.tsx");
  assert.match(settings, /photoEnabled: boolean/);
  assert.match(settings, /filmEnabled: boolean/);
  assert.match(query, /workspaceId: options\.workspaceId, status: "PUBLISHED"/);
  assert.match(query, /visibility: "VISIBLE"/);
  assert.match(query, /excludedProjectIds/);
  assert.match(query, /excludedMediaIds/);
  assert.match(settingsEndpoint, /ids\(body\.excludedProjectIds\)/);
  assert.match(settingsEndpoint, /ids\(body\.excludedMediaIds\)/);
  assert.match(settingsEndpoint, /VERCEL_ENV === "preview"/);
  assert.match(portfolio, /Quick Browse/);
  assert.match(photos, /\/api\/portfolio\/gallery\?offset=/);
  assert.match(films, /\/api\/portfolio\/films\?offset=/);
  assert.doesNotMatch(read("../app/page.tsx"), /PhotographyBrowser|FilmsBrowser|Quick Browse/);
});

test("featured projects enforce six, require replacement confirmation, and never delete projects", () => {
  const portfolio = read("../app/portfolio/page.tsx");
  const manager = read("../app/admin/projects/FeaturedProjectsManager.tsx");
  const endpoint = read("../app/api/admin/projects/featured/route.ts");
  const workflow = read("../app/api/admin/projects/[projectId]/workflow/route.ts");
  assert.match(portfolio, /\.slice\(0, 6\)/);
  assert.match(endpoint, /projectIds\.length > 6/);
  assert.match(endpoint, /new Set\(projectIds\)\.size/);
  assert.match(manager, /Confirm Replacement/);
  assert.match(manager, /More than 6 projects are currently featured/);
  assert.match(workflow, /activeFeatured >= 6/);
  assert.match(endpoint, /VERCEL_ENV === "preview"/);
  assert.doesNotMatch(endpoint, /\.delete\(|deleteMany/);
  assert.doesNotMatch(endpoint, /status: "ARCHIVED"/);
});

test("media intent uses durable anchors, focus placement, reduced motion, and fallback", () => {
  const portfolio = read("../app/portfolio/page.tsx");
  const project = read("../app/portfolio/[slug]/page.tsx");
  const navigator = read("../app/portfolio/[slug]/MediaIntentNavigator.tsx");
  assert.match(portfolio, /\?from=\$\{encodeURIComponent\(selectedService\.slug\)\}#/);
  assert.match(project, /id=\{collection\.anchor\}/);
  assert.match(project, /View the Complete Project/);
  assert.match(navigator, /prefers-reduced-motion: reduce/);
  assert.match(navigator, /heading\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(navigator, /history\.replaceState/);
  assert.match(navigator, /window\.scrollTo\(\{ top: 0/);
});

test("gallery routes provide unique metadata and defer media resources", () => {
  assert.match(read("../app/portfolio/gallery/page.tsx"), /Real Estate Photography Gallery/);
  assert.match(read("../app/portfolio/films/page.tsx"), /Real Estate Film Gallery/);
  assert.match(read("../app/sitemap.ts"), /discoverySettings\.photoEnabled/);
  assert.match(read("../app/sitemap.ts"), /discoverySettings\.filmEnabled/);
  assert.match(read("../app/portfolio/films/FilmsBrowser.tsx"), /preload="metadata"/);
  assert.doesNotMatch(read("../app/portfolio/films/FilmsBrowser.tsx"), /autoPlay/);
});
