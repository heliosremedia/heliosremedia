import assert from "node:assert/strict";
import test from "node:test";
import { featuredTestimonialWhere, getTestimonialPosition } from "./testimonials.ts";

test("featured testimonials include curated Google reviews without changing provenance", () => {
  const records = [
    { name: "Kassi", published: true, featured: true, sourceProvider: "GOOGLE" },
    { name: "Existing agent", published: true, featured: true, sourceProvider: "MANUAL" },
    { name: "Draft", published: false, featured: true, sourceProvider: "GOOGLE" },
    { name: "Unfeatured", published: true, featured: false, sourceProvider: "MANUAL" },
  ];
  const selected = records.filter((record) => Object.entries(featuredTestimonialWhere).every(([key, value]) => record[key as "published" | "featured"] === value));
  assert.deepEqual(selected.map(({ name }) => name), ["Kassi", "Existing agent"]);
  assert.equal(selected[0].sourceProvider, "GOOGLE");
});

for (const total of [1, 2, 3, 4, 14, 50]) {
  test(`${total} testimonials have unique visible slots at every carousel index`, () => {
    for (let active = 0; active < total; active++) {
      const positions = Array.from({ length: total }, (_, index) => getTestimonialPosition(index, active, total));
      assert.equal(positions[active], "active");
      const visible = positions.filter((position) => position !== "hidden");
      assert.equal(visible.length, Math.min(total, 3));
      assert.equal(new Set(visible).size, visible.length);
      if (total > 1) assert.equal(positions[(active + 1) % total], "right");
      if (total > 2) assert.equal(positions[(active - 1 + total) % total], "left");
    }
  });
}

test("empty carousel has no visible card", () => {
  assert.equal(getTestimonialPosition(0, 0, 0), "hidden");
});
