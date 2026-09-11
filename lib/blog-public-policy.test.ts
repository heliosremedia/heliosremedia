import assert from "node:assert/strict";
import test from "node:test";
import { canPreviewBlogPost } from "./blog-public-policy.ts";
test("Blog preview authority must match both host and stored ownership", () => {
  assert.equal(canPreviewBlogPost(undefined, "a", "a"), false);
  assert.equal(canPreviewBlogPost("b", "a", "a"), false);
  assert.equal(canPreviewBlogPost("a", "a", "b"), false);
  assert.equal(canPreviewBlogPost("a", "a", "a"), true);
  assert.equal(canPreviewBlogPost("a", "a", null), true);
  assert.equal(canPreviewBlogPost("b", "a", null), false);
});
