import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HOMEPAGE_CURATION_PREFERENCES,
  normalizeHomepageCurationPreferences,
} from "./homepage-curation-layout.ts";

test("homepage curation preferences use the safe default layout", () => {
  assert.deepEqual(normalizeHomepageCurationPreferences(null), DEFAULT_HOMEPAGE_CURATION_PREFERENCES);
});

test("homepage curation preferences ignore unknown and duplicate section IDs", () => {
  assert.deepEqual(normalizeHomepageCurationPreferences({
    order: ["our-work", "unknown", "our-work", "homepage-media"],
    collapsed: ["unknown", "homepage-media", "homepage-media"],
  }), {
    order: ["our-work", "homepage-media", "homepage-navigation", "featured-project", "homepage-structure"],
    collapsed: ["homepage-media"],
  });
});

test("new homepage curation sections are appended to a saved layout", () => {
  const preferences = normalizeHomepageCurationPreferences({ order: ["featured-project"], collapsed: [] });
  assert.equal(preferences.order[0], "featured-project");
  assert.equal(preferences.order.length, 5);
});
