import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("public collections use assigned active services", () => {
  const page = read("app/portfolio/[slug]/page.tsx");
  assert.match(page, /buildPublicPortfolioCollections/);
  assert.match(page, /serviceId: true/);
  assert.match(page, /collection\.service\.name/);
});

test("portfolio thumbnails are optimized without full-resolution lightbox requests", () => {
  const gallery = read("app/portfolio/[slug]/PortfolioGallery.tsx");
  assert.match(gallery, /sizes="144px"/);
  assert.match(gallery, /50vw[\s\S]*33vw[\s\S]*25vw/);
  assert.match(gallery, /w=1600&q=75/);
  assert.match(gallery, /Loading image/);
  assert.match(gallery, /This image could not be loaded/);
  assert.doesNotMatch(gallery, /adjacentPortfolioIndexes|helios:public-navigation-start/);
});

test("the production-breaking global route interceptor stays absent", () => {
  const layout = read("app/layout.tsx");
  const projectPage = read("app/portfolio/[slug]/page.tsx");
  assert.doesNotMatch(layout, /PublicRouteTransition/);
  assert.doesNotMatch(projectPage, /contentVisibility|containIntrinsicSize/);
  assert.equal(
    (() => {
      try {
        read("app/components/PublicRouteTransition.tsx");
        return true;
      } catch {
        return false;
      }
    })(),
    false,
  );
});
