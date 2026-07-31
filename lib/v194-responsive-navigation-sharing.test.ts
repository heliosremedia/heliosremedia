import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mediaCategoryForServiceSlug, mediaFolderForService } from "./service-media.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("adaptive section navigation wraps on desktop and uses a mobile jump control", () => {
  const source = read("app/admin/components/AdminSectionNavigator.tsx");
  assert.match(source, /Jump to Section/);
  assert.match(source, /md:hidden/);
  assert.match(source, /auto-fit/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /border-t border-white\/10/);
  assert.doesNotMatch(source, /overflow-x-auto|min-w-max/);
});

test("shared card controls use refined orange interaction states", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /hover:border-\[var\(--helios-orange\)\]/);
  assert.match(styles, /active:bg-\[var\(--helios-orange\)\]/);
  assert.match(styles, /focus-visible:ring-\[var\(--helios-orange\)\]/);
  assert.match(styles, /disabled:pointer-events-none/);
});

test("About Team retains the shared summary card when collapsed", () => {
  const source = read("app/admin/about/AboutPageManager.tsx");
  assert.match(source, /id="about-team"/);
  assert.match(source, /eyebrow="People"/);
  assert.match(source, /title="Team members"/);
  assert.match(source, /controls=\{contentId\}/);
  assert.match(source, /hidden=\{collapsed\}/);
});

test("social metadata uses configured domain, revisioned default image, and page precedence", () => {
  const seo = read("lib/seo.ts");
  const layout = read("app/layout.tsx");
  const project = read("app/portfolio/[slug]/page.tsx");
  const blog = read("app/blog/[slug]/page.tsx");
  assert.match(seo, /image \|\| configuredDefault \|\| "\/work\/modern-retreat\.jpg"/);
  assert.match(seo, /defaultSocialImageVersion/);
  assert.match(seo, /secureUrl/);
  assert.match(seo, /width: 1200, height: 630/);
  assert.match(seo, /getConfiguredAbsoluteUrl/);
  assert.match(layout, /buildPageMetadata/);
  assert.match(project, /resolveProjectSocialImage/);
  assert.match(blog, /buildPageMetadata/);
  assert.doesNotMatch(blog, /https:\/\/www\.heliosremedia\.com/);
});

test("Client Portal provides an accessible reduced-motion scroll cue", () => {
  const indicator = read("app/client-portal/PortalScrollIndicator.tsx");
  const page = read("app/client-portal/page.tsx");
  assert.match(indicator, /Choose Your Portal/);
  assert.match(indicator, /aria-label="View portal options"/);
  assert.match(indicator, /prefers-reduced-motion/);
  assert.match(page, /id="portal-options"/);
  assert.match(page, /PortalScrollIndicator/);
});

test("V1.9.4 release metadata remains finalized", () => {
  const releases = read("lib/releases.ts");
  assert.ok(releases.indexOf('version: "V1.9.4"') < releases.indexOf('version: "V1.9.3.1"'));
  assert.match(releases, /title: "Responsive Navigation and Sharing Refinement"/);
  assert.match(releases, /version: "V1\.9\.4"[\s\S]*releaseDate: "2026-07-31"[\s\S]*status: "LIVE"/);
});

test("dynamic project media uses stable workspace service IDs", () => {
  const schema = read("prisma/schema.prisma");
  const mediaRoute = read("app/api/admin/projects/[projectId]/media/route.ts");
  const manager = read("app/admin/projects/[projectId]/ProjectMediaManager.tsx");
  const uploader = read("app/admin/projects/[projectId]/MediaUploader.tsx");
  assert.match(schema, /model Service[\s\S]*workspaceId[\s\S]*archivedAt/);
  assert.match(schema, /model Media[\s\S]*serviceId/);
  assert.match(schema, /@@id\(\[projectId, serviceId\]\)/);
  assert.match(mediaRoute, /workspaceId: session\.workspaceId/);
  assert.match(mediaRoute, /active: true, archivedAt: null/);
  assert.match(mediaRoute, /projectService\.createMany/);
  assert.match(manager, /services\.filter\(\(service\) => service\.active/);
  assert.match(uploader, /activeServices\.map/);
  assert.doesNotMatch(manager, /MEDIA_COLLECTIONS\.map/);
});

test("legacy categories remain compatible while new services use OTHER", () => {
  assert.equal(mediaCategoryForServiceSlug("photography"), "PHOTOGRAPHY");
  assert.equal(mediaCategoryForServiceSlug("cinematic-films"), "CINEMATIC_FILM");
  assert.equal(mediaCategoryForServiceSlug("twilight-photography"), "OTHER");
  assert.equal(mediaCategoryForServiceSlug("ai-cinematic-films"), "OTHER");
  assert.notEqual(
    mediaFolderForService({ id: "svc-a", slug: "twilight-photography" }),
    mediaFolderForService({ id: "svc-b", slug: "twilight-photography" }),
  );
});

test("setting Hero moves the image to position 01 and announces the result", () => {
  const route = read("app/api/admin/projects/[projectId]/media/route.ts");
  const manager = read("app/admin/projects/[projectId]/ProjectMediaManager.tsx");
  assert.match(route, /const reorderedIds = \[/);
  assert.match(route, /displayOrder: index/);
  assert.match(route, /Hero image set and moved to top/);
  assert.match(manager, /aria-live="polite"/);
  assert.match(manager, /setAnnouncement\(data\.message/);
});

test("service archival preserves related media and removes new destinations", () => {
  const migration = read("prisma/migrations/20260731123000_v194_dynamic_service_media/migration.sql");
  const serviceRoute = read("app/api/admin/services/route.ts");
  assert.match(migration, /never deletes media/i);
  assert.match(migration, /Media_serviceId_fkey/);
  assert.match(serviceRoute, /action === "archive"/);
  assert.match(serviceRoute, /active: false, archivedAt: new Date\(\)/);
});
