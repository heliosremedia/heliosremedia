import assert from "node:assert/strict";
import test from "node:test";
import { prepareBlogImagePrompt, suggestBlogImageAltText } from "./blog-image.ts";

test("blog image prompt uses publishable article context and safeguards", () => {
  const prompt = prepareBlogImagePrompt({
    title: "Why twilight photography matters",
    excerpt: "A practical guide for listing agents.",
    content: "Twilight imagery can establish atmosphere and exterior lighting.",
    category: "Education",
    seoTitle: "Twilight real estate photography",
  });
  assert.match(prompt, /Why twilight photography matters/);
  assert.match(prompt, /Education/);
  assert.match(prompt, /fabricated property/);
  assert.ok(prompt.length <= 2_000);
});

test("blog image prompt requires useful context and suggests editable alt text", () => {
  assert.equal(prepareBlogImagePrompt({}), "");
  assert.equal(
    suggestBlogImageAltText({ title: "A better listing launch" }),
    "Editorial featured image for A better listing launch",
  );
});
