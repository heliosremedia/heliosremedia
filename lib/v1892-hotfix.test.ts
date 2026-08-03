import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("site settings preserve the required information architecture", () => {
  const form = read("../app/admin/settings/SiteSettingsForm.tsx");
  const navigation = form.slice(form.indexOf("Site Settings sections"));
  const business = navigation.indexOf("Brand Identity");
  const booking = navigation.indexOf("Booking Experience");
  const content = navigation.indexOf("Content & Discovery");
  const legal = navigation.indexOf("Legal & Privacy");
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

test("site settings navigation stays below the Studio header and remains responsive", () => {
  const form = read("../app/admin/settings/SiteSettingsForm.tsx");
  const navigator = read("../app/admin/components/AdminSectionNavigator.tsx");
  assert.match(form, /<AdminSectionNavigator[\s\S]*?siteSettings/);
  assert.match(navigator, /data-site-settings-navigation-anchor/);
  assert.match(navigator, /window\.addEventListener\("scroll", updatePinnedFrame, \{ passive: true \}\)/);
  assert.match(navigator, /fixed top-20 z-20 bg-\[#151515\]/);
  assert.match(navigator, /height: pinnedFrame\.height/);
  assert.match(navigator, /left: pinnedFrame\.left, width: pinnedFrame\.width/);
  assert.match(navigator, /createPortal\(navigator, document\.body\)/);
  assert.match(navigator, /xl:grid-cols-7/);
  assert.match(navigator, /Jump to Section/);
  assert.match(navigator, /stickyClearance/);
  assert.match(navigator, /navigatorRef\.current\?\.getBoundingClientRect\(\)\.height/);
  assert.match(navigator, /target\.tabIndex = -1/);
  assert.match(navigator, /focus-visible:ring-2/);
});
