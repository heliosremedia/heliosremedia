import assert from "node:assert/strict";
import test from "node:test";
import { moveSelectedProjects, moveSelectedProjectsByBoundary } from "./project-order.ts";

const items = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
const ids = (value: { id: string }[]) => value.map(({ id }) => id);

test("group drag preserves relative order for nonadjacent selections", () => {
  assert.deepEqual(ids(moveSelectedProjects(items, new Set(["b", "d"]), "a")), ["b", "d", "a", "c", "e"]);
});

test("boundary moves preserve relative order and stop at edges", () => {
  assert.deepEqual(ids(moveSelectedProjectsByBoundary(items, new Set(["b", "d"]), "top")), ["b", "d", "a", "c", "e"]);
  assert.deepEqual(ids(moveSelectedProjectsByBoundary(items, new Set(["b", "d"]), "bottom")), ["a", "c", "e", "b", "d"]);
  assert.deepEqual(ids(moveSelectedProjectsByBoundary(items, new Set(["a"]), "up")), ids(items));
  assert.deepEqual(ids(moveSelectedProjectsByBoundary(items, new Set(["e"]), "down")), ids(items));
});

test("single-step group moves keep selected items together", () => {
  assert.deepEqual(ids(moveSelectedProjectsByBoundary(items, new Set(["c", "d"]), "up")), ["a", "c", "d", "b", "e"]);
  assert.deepEqual(ids(moveSelectedProjectsByBoundary(items, new Set(["b", "c"]), "down")), ["a", "d", "b", "c", "e"]);
});
