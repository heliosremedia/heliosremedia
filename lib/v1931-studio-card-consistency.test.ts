import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shared card controls expose the required icon and accessibility contract", () => {
  const controls = read("app/admin/components/AdminCardControls.tsx");
  assert.match(controls, /admin-btn-icon/);
  assert.match(controls, /title=\{label\}/);
  assert.match(controls, /aria-label=\{label\}/);
  assert.match(controls, /aria-expanded=\{expanded\}/);
  assert.match(controls, /aria-controls=\{controls\}/);
  assert.match(controls, /type="button"/);
  assert.match(controls, /symbol: "\+" \| "−" \| "↑" \| "↓"/);
  assert.match(controls, /symbol=\{expanded \? "−" : "\+"\}/);
});

test("homepage and dashboard use drag, arrow, and toggle controls in order", () => {
  for (const path of [
    "app/admin/homepage/HomepageCurationOrganizer.tsx",
    "app/admin/components/DashboardOrganizer.tsx",
  ]) {
    const source = read(path);
    const drag = source.indexOf("<AdminDragHandle");
    const up = source.indexOf('symbol="↑"', drag);
    const down = source.indexOf('symbol="↓"', up);
    const toggle = source.indexOf("<AdminCardToggle", down);
    assert.ok(drag >= 0 && drag < up && up < down && down < toggle);
    assert.doesNotMatch(source, />Move Up<|>Move Down<|\{collapsed \? "Expand" : "Collapse"\}/);
  }
});

test("Site Settings uses complete collapsed destinations and corrected hierarchy", () => {
  const source = read("app/admin/settings/SiteSettingsForm.tsx");
  for (const destination of [
    "brand-identity",
    "brand-assets",
    "booking-experience",
    "global-controls",
    "content-discovery",
    "search-appearance",
    "legal-privacy",
  ]) assert.match(source, new RegExp(destination));
  assert.match(source, /"brand-identity": true/);
  assert.match(source, /"brand-assets": false/);
  assert.match(source, /Expand All/);
  assert.match(source, /Collapse All/);
  assert.match(source, /h-7 w-px bg-white\/10/);
  assert.match(source, /Business Information/);
  assert.match(source, /Location Information/);
  assert.match(source, /Website & Social Links/);
  assert.doesNotMatch(source, />Business identity</i);
  assert.match(source, /revealInvalidParent/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
});

test("V1.9.3.1 release metadata is deploying before production verification", () => {
  const version = read("lib/version.ts");
  const releases = read("lib/releases.ts");
  assert.match(version, /STUDIO_VERSION = "V1\.9\.3\.1"/);
  assert.match(version, /v1-9-3-1/);
  assert.ok(releases.indexOf('version: "V1.9.3.1"') < releases.indexOf('version: "V1.9.3"'));
  assert.match(releases, /title: "Studio Card Consistency Hotfix"/);
  assert.match(releases, /releaseDate: null/);
  assert.match(releases, /status: "DEPLOYING"/);
});
