import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { contentHash } from "./content-hash.ts";
import { verifyNewsletterRevisionIntegrity } from "./integrity.ts";

const editorSnapshot = {
  subject: "Twilight Guidance",
  previewText: "Practical guidance",
  blocks: [{
    type: "HERO",
    internalLabel: "Hero",
    eyebrow: "Helios newsletter",
    heading: "Intentional media",
    body: "Clear and compelling.",
    imageUrl: "",
    altText: "",
    imageLink: "",
    imageIsVideo: false,
    imageSelection: {
      mode: "AUTO",
      sourceLabel: "",
      attribution: "",
    },
    imageCandidates: [],
    link: "",
    buttonLabel: "",
    alignment: "left",
    imageAlt: "",
    linkUrl: "",
    sourceIds: [],
  }],
};

test("canonical newsletter hashes ignore jsonb object key reordering", () => {
  const reordered = {
    blocks: [{
      sourceIds: [],
      linkUrl: "",
      imageSelection: {
        attribution: "",
        sourceLabel: "",
        mode: "AUTO",
      },
      type: "HERO",
      heading: "Intentional media",
      internalLabel: "Hero",
      eyebrow: "Helios newsletter",
      body: "Clear and compelling.",
      imageUrl: "",
      altText: "",
      imageLink: "",
      imageIsVideo: false,
      imageCandidates: [],
      link: "",
      buttonLabel: "",
      alignment: "left",
      imageAlt: "",
    }],
    previewText: "Practical guidance",
    subject: "Twilight Guidance",
  };
  assert.equal(contentHash(editorSnapshot), contentHash(reordered));
});

test("legacy editor hashes remain verifiable after jsonb reorders keys", () => {
  const storedHash = createHash("sha256")
    .update(JSON.stringify(editorSnapshot))
    .digest("hex");
  const jsonbSnapshot = {
    subject: editorSnapshot.subject,
    previewText: editorSnapshot.previewText,
    blocks: editorSnapshot.blocks.map((block) => ({
      alignment: block.alignment,
      altText: block.altText,
      body: block.body,
      buttonLabel: block.buttonLabel,
      eyebrow: block.eyebrow,
      heading: block.heading,
      imageAlt: block.imageAlt,
      imageCandidates: block.imageCandidates,
      imageIsVideo: block.imageIsVideo,
      imageLink: block.imageLink,
      imageSelection: {
        attribution: block.imageSelection.attribution,
        mode: block.imageSelection.mode,
        sourceLabel: block.imageSelection.sourceLabel,
      },
      imageUrl: block.imageUrl,
      internalLabel: block.internalLabel,
      link: block.link,
      linkUrl: block.linkUrl,
      sourceIds: block.sourceIds,
      type: block.type,
    })),
  };
  const result = verifyNewsletterRevisionIntegrity(jsonbSnapshot, storedHash);
  assert.equal(result.valid, true);
  assert.equal(result.format, "LEGACY_EDITOR");
});

test("content changes still fail legacy and canonical integrity checks", () => {
  const storedHash = createHash("sha256")
    .update(JSON.stringify(editorSnapshot))
    .digest("hex");
  const changed = structuredClone(editorSnapshot);
  changed.blocks[0].body = "Changed after approval.";
  assert.equal(
    verifyNewsletterRevisionIntegrity(changed, storedHash).valid,
    false,
  );
});
