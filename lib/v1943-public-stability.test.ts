import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adjacentPortfolioIndexes,
  portfolioImageDerivativeUrl,
  selectPortfolioLightboxWidth,
} from "./portfolio-image-delivery.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("lightbox derivatives are bounded, encoded, and tenant-safe", () => {
  const source = "https://r2.example/projects/workspace-1/project-2/image.jpg?v=4";
  assert.equal(selectPortfolioLightboxWidth(375, 812, 3), 2560);
  assert.equal(selectPortfolioLightboxWidth(1440, 900, 1), 1600);
  assert.equal(selectPortfolioLightboxWidth(3840, 2160, 2), 2560);
  assert.equal(
    portfolioImageDerivativeUrl(source, 1920, 85),
    `/_next/image?url=${encodeURIComponent(source)}&w=1920&q=85`,
  );
});

test("only immediately adjacent viewing images are selected for preload", () => {
  assert.deepEqual(adjacentPortfolioIndexes(0, 7), [6, 1]);
  assert.deepEqual(adjacentPortfolioIndexes(1, 2), [0]);
  assert.deepEqual(adjacentPortfolioIndexes(0, 1), []);
});

test("lightbox has immediate shell, loading, retry, stale-element, and original-download contracts", () => {
  const gallery = read("app/portfolio/[slug]/PortfolioGallery.tsx");
  assert.match(gallery, /role="dialog"/);
  assert.match(gallery, /aria-modal="true"/);
  assert.match(gallery, /Loading image/);
  assert.match(gallery, /This image could not be loaded/);
  assert.match(gallery, />\s*Retry\s*</);
  assert.match(gallery, /key=\{`\$\{activeMedia\.id\}:\$\{lightboxAttempt\}:\$\{lightboxWidth\}`\}/);
  assert.match(gallery, /Download Original/);
  assert.match(gallery, /activeViewingUrl/);
  assert.doesNotMatch(gallery, /<Image[\s\S]{0,250}quality=\{95\}/);
  assert.match(gallery, /helios:public-navigation-start/);
});

test("public route transitions preserve native exceptions and clean up deterministically", () => {
  const transition = read("app/components/PublicRouteTransition.tsx");
  const layout = read("app/layout.tsx");
  assert.match(transition, /document\.addEventListener\("click", onClick, true\)/);
  assert.match(transition, /event\.metaKey[\s\S]*event\.ctrlKey/);
  assert.match(transition, /target\.hasAttribute\("download"\)/);
  assert.match(transition, /prefers-reduced-motion: reduce/);
  assert.match(transition, /window\.clearTimeout/);
  assert.match(transition, /helios:public-navigation-start/);
  assert.match(transition, /main\.focus\(\{ preventScroll: true \}\)/);
  assert.match(layout, /<PublicRouteTransition>\{children\}<\/PublicRouteTransition>/);
});

test("dynamic collections remain intact and V1.9.4.3 is LIVE", () => {
  const page = read("app/portfolio/[slug]/page.tsx");
  const version = read("lib/version.ts");
  const releases = read("lib/releases.ts");
  assert.match(page, /buildPublicPortfolioCollections/);
  assert.match(page, /portfolioCollectionAnchor\(collection\.service\.id\)/);
  assert.doesNotMatch(page, /MEDIA_COLLECTIONS/);
  assert.match(version, /STUDIO_VERSION = "V1\.9\.4\.3"/);
  assert.match(releases, /version: "V1\.9\.4\.3"[\s\S]*releaseDate: "2026-07-31"[\s\S]*status: "LIVE"/);
});
