import assert from "node:assert/strict";
import test from "node:test";
import { gallerySlice, mediaIntentAnchor, orderDiscoveryAssets } from "./portfolio-discovery-core.ts";

const assets = [
  { id: "a1", projectId: "a", projectOrder: 0, mediaOrder: 0, createdAt: "2026-01-01", aspectRatio: 1.5 },
  { id: "a2", projectId: "a", projectOrder: 0, mediaOrder: 1, createdAt: "2026-01-02", aspectRatio: 0.6 },
  { id: "b1", projectId: "b", projectOrder: 1, mediaOrder: 0, createdAt: "2026-02-01", aspectRatio: 1 },
  { id: "c1", projectId: "c", projectOrder: 2, mediaOrder: 0, createdAt: "2026-03-01", aspectRatio: 2 },
];

test("curated order is preserved and duplicate assets are removed", () => {
  assert.deepEqual(orderDiscoveryAssets([...assets, assets[0]], "CURATED", "seed").map(({ id }) => id), ["a1", "a2", "b1", "c1"]);
});

test("rotating mix is deterministic and avoids consecutive projects when possible", () => {
  const first = orderDiscoveryAssets(assets, "ROTATING_MIX", "session-one");
  const second = orderDiscoveryAssets(assets, "ROTATING_MIX", "session-one");
  assert.deepEqual(first, second);
  for (let index = 1; index < first.length; index += 1) assert.notEqual(first[index - 1].projectId, first[index].projectId);
});

test("progressive slices are bounded", () => {
  assert.deepEqual(gallerySlice(assets, 0, 2), { items: assets, nextOffset: null, total: 4 });
  const many = Array.from({ length: 30 }, (_, id) => id);
  assert.deepEqual(gallerySlice(many, 0, 18), { items: many.slice(0, 18), nextOffset: 18, total: 30 });
});

test("every public filter maps to a durable destination", () => {
  assert.equal(mediaIntentAnchor("photography"), "photography-gallery");
  assert.equal(mediaIntentAnchor("drone-photography"), "drone-photography-gallery");
  assert.equal(mediaIntentAnchor("cinematic-films"), "cinematic-films");
  assert.equal(mediaIntentAnchor("agent-branding"), "agent-branded-films");
  assert.equal(mediaIntentAnchor("ai-cinematic-films"), "ai-cinematic-films");
  assert.equal(mediaIntentAnchor("vertical-reels"), "vertical-reels");
  assert.equal(mediaIntentAnchor("social-content"), "social-content");
  assert.equal(mediaIntentAnchor("twilight-photography"), "twilight-photography-gallery");
  assert.equal(mediaIntentAnchor(null), null);
});
