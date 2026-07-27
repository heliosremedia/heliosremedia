import assert from "node:assert/strict";
import test from "node:test";
import { selectBalancedAboutImages } from "./about-gallery.ts";

test("About gallery randomizer returns distinct and varied assets", () => {
  const selected = selectBalancedAboutImages(
    [
      { assetId: "room", label: "Wide living room", altText: "" },
      { assetId: "detail", label: "Fireplace detail", altText: "" },
      { assetId: "outside", label: "Front exterior", altText: "" },
      { assetId: "room", label: "Duplicate room", altText: "" },
    ],
    () => 0.5,
  );
  assert.deepEqual(
    new Set(selected.map((item) => item.assetId)).size,
    3,
  );
  assert.deepEqual(
    new Set(selected.map((item) => item.label)),
    new Set(["Wide living room", "Fireplace detail", "Front exterior"]),
  );
});
