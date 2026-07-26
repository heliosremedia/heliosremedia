import assert from "node:assert/strict";
import test from "node:test";
import {
  orderProjectMedia,
  parseNewsletterGalleryQuery,
} from "./gallery-projects.ts";

test("gallery defaults to all projects, all images, and the first page", () => {
  assert.deepEqual(parseNewsletterGalleryQuery(new URLSearchParams()), {
    search: "",
    source: "ALL",
    projectId: null,
    page: 1,
  });
});

test("gallery preserves stable project IDs alongside source and keyword filters", () => {
  const query = parseNewsletterGalleryQuery(new URLSearchParams({
    projectId: "project_123",
    source: "portfolio",
    search: "  kitchen  ",
    page: "3",
  }));
  assert.deepEqual(query, {
    search: "kitchen",
    source: "PORTFOLIO",
    projectId: "project_123",
    page: 3,
  });
});

test("changing or clearing project filters can reset pagination through page one", () => {
  const changed = parseNewsletterGalleryQuery(new URLSearchParams({
    projectId: "project_456",
    page: "1",
  }));
  const cleared = parseNewsletterGalleryQuery(new URLSearchParams({ page: "1" }));
  assert.equal(changed.page, 1);
  assert.equal(cleared.projectId, null);
  assert.equal(cleared.page, 1);
});

test("project cover is first and remaining media retain gallery order", () => {
  const result = orderProjectMedia([
    { id: "third", displayOrder: 30 },
    { id: "cover", displayOrder: 20 },
    { id: "first", displayOrder: 10 },
  ], "cover");
  assert.deepEqual(result.map(item => item.id), ["cover", "first", "third"]);
});
