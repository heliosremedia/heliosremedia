import assert from "node:assert/strict";
import test from "node:test";
import {
  preserveManualImage,
  safeNewsletterImageUrl,
  suggestedCandidate,
  validateCandidateId,
} from "./source-images.ts";
import type { NewsletterImageCandidate } from "./types.ts";
import { renderNewsletterImage } from "./email-images.ts";

const candidates: NewsletterImageCandidate[] = [
  {
    id: "project:1:gallery", sourceId: "project:1", sourceKind: "PROJECT",
    sourceRecordId: "1", url: "https://cdn.example.com/gallery.jpg",
    label: "Gallery", role: "GALLERY_IMAGE", priority: 40,
  },
  {
    id: "project:1:cover", sourceId: "project:1", sourceKind: "PROJECT",
    sourceRecordId: "1", url: "https://cdn.example.com/cover.jpg",
    label: "Cover", role: "PORTFOLIO_COVER", priority: 10,
  },
  {
    id: "blog:2:featured", sourceId: "blog:2", sourceKind: "BLOG_POST",
    sourceRecordId: "2", url: "https://cdn.example.com/blog.jpg",
    label: "Featured", role: "FEATURED_IMAGE", priority: 10,
  },
];

test("source priority chooses the strongest candidate belonging to the cited source", () => {
  assert.equal(
    suggestedCandidate("PORTFOLIO_SPOTLIGHT", ["project:1"], candidates)?.id,
    "project:1:cover",
  );
  assert.equal(suggestedCandidate("HELPFUL_TIP", ["project:1"], candidates), undefined);
});

test("candidate IDs must be present in the verified manifest", () => {
  assert.equal(validateCandidateId("blog:2:featured", candidates), "blog:2:featured");
  assert.throws(
    () => validateCandidateId("invented:image", candidates),
    /not available from the verified source/,
  );
});

test("newsletter image URLs require public HTTPS", () => {
  assert.equal(
    safeNewsletterImageUrl("https://cdn.example.com/image.jpg"),
    "https://cdn.example.com/image.jpg",
  );
  assert.equal(safeNewsletterImageUrl("javascript:alert(1)"), "");
  assert.equal(safeNewsletterImageUrl("data:image/png;base64,abc"), "");
  assert.equal(safeNewsletterImageUrl("file:///tmp/private.jpg"), "");
  assert.equal(safeNewsletterImageUrl("http://cdn.example.com/image.jpg"), "");
});

test("manual source, custom, and no-image choices survive block regeneration", () => {
  for (const mode of ["SOURCE", "CUSTOM", "NONE"] as const) {
    const current = {
      imageUrl: mode === "NONE" ? "" : "https://cdn.example.com/manual.jpg",
      altText: "Administrator choice",
      imageSelection: { mode },
      imageCandidates: candidates,
    };
    const result = preserveManualImage(current, {
      imageUrl: "https://cdn.example.com/automatic.jpg",
      imageSelection: { mode: "AUTO" },
    });
    assert.deepEqual(result.imageSelection, { mode });
    assert.equal(result.imageUrl, current.imageUrl);
  }
});

test("automatic image choices may refresh during regeneration", () => {
  const result = preserveManualImage(
    { imageUrl: "https://cdn.example.com/old.jpg", imageSelection: { mode: "AUTO" } },
    { imageUrl: "https://cdn.example.com/new.jpg", imageSelection: { mode: "AUTO" } },
  );
  assert.equal(result.imageUrl, "https://cdn.example.com/new.jpg");
});

test("delivered email renders a responsive linked image with stable alt text", () => {
  const html = renderNewsletterImage({
    imageUrl: "https://cdn.example.com/cover.jpg",
    imageAlt: "Twilight exterior photography",
    imageLink: "https://www.heliosremedia.com/portfolio/eaton-farm",
  });
  assert.match(html, /href="https:\/\/www\.heliosremedia\.com\/portfolio\/eaton-farm"/);
  assert.match(html, /src="https:\/\/cdn\.example\.com\/cover\.jpg"/);
  assert.match(html, /alt="Twilight exterior photography"/);
  assert.match(html, /width:100%;max-width:640px;height:auto/);
  assert.equal(renderNewsletterImage({ imageUrl: "javascript:alert(1)" }), "");
});
