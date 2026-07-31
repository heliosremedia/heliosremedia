import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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

test("V1.9.4 release metadata is deploying before production authorization", () => {
  const version = read("lib/version.ts");
  const releases = read("lib/releases.ts");
  assert.match(version, /STUDIO_VERSION = "V1\.9\.4"/);
  assert.match(version, /v1-9-4/);
  assert.ok(releases.indexOf('version: "V1.9.4"') < releases.indexOf('version: "V1.9.3.1"'));
  assert.match(releases, /title: "Responsive Navigation and Sharing Refinement"/);
  assert.match(releases, /releaseDate: null/);
  assert.match(releases, /status: "DEPLOYING"/);
});
