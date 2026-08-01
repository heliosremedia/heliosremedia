import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildPublicPortfolioCollections,
  portfolioCollectionAnchor,
} from "./portfolio-collections.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("public collections resolve current names and order through stable service IDs", () => {
  const services = [
    { id: "svc-photo", name: "Photography", slug: "photography", active: true },
    { id: "svc-twilight", name: "Twilight Photography", slug: "twilight-photography", active: true },
    { id: "svc-hidden", name: "Hidden", slug: "hidden", active: false },
  ];
  const media = [
    { id: "twilight-1", serviceId: "svc-twilight" },
    { id: "photo-1", serviceId: "svc-photo" },
    { id: "hidden-1", serviceId: "svc-hidden" },
  ];
  const collections = buildPublicPortfolioCollections(services, media);
  assert.deepEqual(collections.map((item) => item.service.name), ["Photography", "Twilight Photography"]);
  assert.deepEqual(collections[1].media.map((item) => item.id), ["twilight-1"]);
  assert.equal(collections[1].anchor, "collection-svc-twilight");
});

test("empty and archived collections are absent without changing source services", () => {
  const services = [
    { id: "svc-empty", name: "Empty", slug: "empty", active: true },
    { id: "svc-archived", name: "Archived", slug: "archived", active: true, archivedAt: "2026-07-31" },
  ];
  assert.deepEqual(buildPublicPortfolioCollections(services, []), []);
  assert.equal(services.length, 2);
  assert.equal(portfolioCollectionAnchor("tenant:service/1"), "collection-tenant-service-1");
});

test("portfolio images use responsive optimized display sources and on-demand originals", () => {
  const gallery = read("app/portfolio/[slug]/PortfolioGallery.tsx");
  const page = read("app/portfolio/[slug]/page.tsx");
  const config = read("next.config.ts");
  assert.match(gallery, /import Image from "next\/image"/);
  assert.match(gallery, /sizes="144px"/);
  assert.match(gallery, /50vw[\s\S]*33vw[\s\S]*25vw/);
  assert.match(gallery, /quality=\{95\}/);
  assert.match(gallery, /download=\{activeMedia\.originalFilename/);
  assert.match(page, /<Image[\s\S]*preload[\s\S]*quality=\{85\}[\s\S]*sizes="100vw"/);
  assert.match(config, /formats: \["image\/avif", "image\/webp"\]/);
  assert.match(config, /minimumCacheTTL: 2678400/);
  assert.doesNotMatch(page, /MEDIA_COLLECTIONS/);
});

test("service navigation focuses stable collection anchors with reduced-motion support", () => {
  const links = read("app/portfolio/[slug]/ProjectServiceLinks.tsx");
  const page = read("app/portfolio/[slug]/page.tsx");
  assert.match(links, /prefers-reduced-motion: reduce/);
  assert.match(links, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(links, /aria-label=\{`View \$\{service\.name\} collection`\}/);
  assert.match(page, /portfolioCollectionAnchor\(collection\.service\.id\)/);
  assert.match(page, /tabIndex=\{-1\}/);
});

test("admin media collections omit empty cards while destinations remain service driven", () => {
  const manager = read("app/admin/projects/[projectId]/ProjectMediaManager.tsx");
  const uploader = read("app/admin/projects/[projectId]/MediaUploader.tsx");
  assert.match(manager, /filter\(\(\{ items \}\) => items\.length > 0\)/);
  assert.match(uploader, /activeServices\.map/);
});

test("V1.9.4.2 is LIVE with accurate release metadata", () => {
  const version = read("lib/version.ts");
  const releases = read("lib/releases.ts");
  assert.match(version, /STUDIO_VERSION = "V1\.9\.4\.2"/);
  assert.match(version, /v1-9-4-2/);
  assert.ok(releases.indexOf('version: "V1.9.4.2"') < releases.indexOf('version: "V1.9.4.1"'));
  assert.match(releases, /title: "Portfolio Collections and Image Performance Hotfix"/);
  assert.match(releases, /version: "V1\.9\.4\.2"[\s\S]*releaseDate: "2026-07-31"[\s\S]*status: "LIVE"/);
});
