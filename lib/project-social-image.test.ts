import assert from "node:assert/strict";
import test from "node:test";
import { optimizeProjectSocialImage, resolveProjectSocialImage, type ProjectSocialMedia } from "./project-social-image.ts";

const image = (id: string, overrides: Partial<ProjectSocialMedia> = {}): ProjectSocialMedia => ({
  id, sourceType: "UPLOADED_IMAGE", storageKey: `projects/p/${id}.jpg`, mimeType: "image/jpeg",
  altText: `${id} alt`, width: 1800, height: 1000, aspectRatio: 1.8,
  visibility: "VISIBLE", displayOrder: 0, ...overrides,
});

test("explicit social image takes priority", () => {
  const result = resolveProjectSocialImage({ title: "Home", socialImageMedia: image("social"), heroMedia: image("hero"), media: [image("gallery")] });
  assert.equal(result.source, "SOCIAL"); assert.match(result.url, /social\.jpg$/); assert.equal(result.alt, "social alt");
});
test("hero falls back before gallery", () => {
  assert.equal(resolveProjectSocialImage({ title: "Home", heroMedia: image("hero"), media: [image("gallery")] }).source, "HERO");
});
test("gallery rejects hidden, video, and unsupported media and prefers landscape", () => {
  const result = resolveProjectSocialImage({ title: "Home", media: [
    image("hidden", { visibility: "HIDDEN" }), image("video", { sourceType: "UPLOADED_VIDEO", mimeType: "video/mp4" }),
    image("gif", { mimeType: "image/gif" }), image("portrait", { width: 1200, height: 1800, aspectRatio: 0.67 }),
    image("landscape", { width: 1800, height: 950, aspectRatio: 1.89 }),
  ] });
  assert.equal(result.source, "GALLERY"); assert.match(result.url, /landscape\.jpg$/);
});
test("video thumbnail and global fallback prevent an empty social image", () => {
  const video = resolveProjectSocialImage({ title: "Film", media: [{
    ...image("video"), sourceType: "VIDEO_EMBED", storageKey: null, mimeType: null,
    externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  }] });
  assert.equal(video.source, "VIDEO_THUMBNAIL"); assert.match(video.url, /^https:\/\//);
  const fallback = resolveProjectSocialImage({ title: "Empty", media: [] });
  assert.equal(fallback.source, "GLOBAL_FALLBACK"); assert.match(fallback.url, /^https?:\/\//);
});
test("missing dimensions are omitted safely and WebP is supported", () => {
  const result = resolveProjectSocialImage({ title: "Home", media: [image("webp", { mimeType: "image/webp", width: null, height: null })] });
  assert.equal(result.type, "image/webp"); assert.equal("width" in result, false); assert.equal("height" in result, false);
});
test("workspace default precedes the monogram and changes only with its stable version", () => {
  const workspace = { businessName: "Studio", defaultSocialImageUrl: "https://cdn.example.com/share.jpg", defaultSocialImageAlt: "Studio share", defaultSocialImageVersion: 4, brandMonogramUrl: "https://cdn.example.com/mark.png" };
  const result = resolveProjectSocialImage({ title: "Empty", media: [], workspace });
  assert.equal(result.source, "WORKSPACE_DEFAULT");
  assert.equal(result.url, "https://cdn.example.com/share.jpg?v=4");
  assert.equal(result.alt, "Studio share");
  const monogram = resolveProjectSocialImage({ title: "Empty", media: [], workspace: { ...workspace, defaultSocialImageUrl: null } });
  assert.equal(monogram.source, "MONOGRAM");
});
test("uploaded share images use the stable existing optimizer instead of full-resolution originals", () => {
  const selected = resolveProjectSocialImage({ title: "Home", socialImageMedia: image("social", { width: 4800, height: 3584 }), media: [] });
  const optimized = optimizeProjectSocialImage(selected, "https://www.example.com");
  assert.equal(optimized.source, "SOCIAL");
  assert.equal(optimized.width, 1200);
  assert.equal(optimized.height, 896);
  assert.equal(optimized.type, undefined);
  assert.match(optimized.url, /^https:\/\/www\.example\.com\/_next\/image\?/);
  assert.match(optimized.url, /w=1200&q=75$/);
});
test("workspace and brand fallbacks retain their stable managed URLs", () => {
  const workspace = optimizeProjectSocialImage({ url: "https://cdn.example.com/share.jpg?v=8", alt: "Share", width: 1200, height: 630, type: "image/jpeg", source: "WORKSPACE_DEFAULT" }, "https://www.example.com");
  assert.equal(workspace.url, "https://cdn.example.com/share.jpg?v=8");
  assert.equal(workspace.type, "image/jpeg");
});
