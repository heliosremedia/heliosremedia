import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("site settings preserve the required information architecture", () => {
  const form = read("../app/admin/settings/SiteSettingsForm.tsx");
  const business = form.indexOf("Business Identity");
  const booking = form.indexOf("Booking Experience");
  const content = form.indexOf("Content &amp; Discovery");
  const legal = form.indexOf("Legal &amp; Privacy");
  assert.ok(business >= 0 && business < booking && booking < content && content < legal);
  assert.ok(form.indexOf("Business and contact") < form.indexOf("Blog Studio Voice"));
  assert.match(form, /availabilityMessage/);
});

test("brand sharing controls and stable project fallback sources are present", () => {
  const manager = read("../app/admin/settings/FaviconManager.tsx");
  const project = read("./project-social-image.ts");
  assert.match(manager, /Default social share image/);
  assert.match(manager, /Restore automatic fallback/);
  assert.match(project, /WORKSPACE_DEFAULT/);
  assert.match(project, /MONOGRAM/);
  assert.match(project, /defaultSocialImageVersion/);
});

test("homepage hero and poster cards publish matching metadata guidance", () => {
  const form = read("../app/admin/settings/SiteSettingsForm.tsx");
  assert.match(form, /MP4 or WebM · 16:9 recommended · up to 500 MB/);
  assert.match(form, /JPG, PNG, WebP, or AVIF · 1920×1080 recommended/);
  assert.doesNotMatch(form, /break-all text-xs text-white\/30/);
});
