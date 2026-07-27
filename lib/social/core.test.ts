import assert from "node:assert/strict";
import test from "node:test";
import {
  canApprove, contentEditState, deriveCampaignStatus, mediaWarning, readyState, scheduleState, sanitizedVerifiedFacts,
} from "./core.ts";

test("campaign state is derived without contradicting variants", () => {
  assert.equal(deriveCampaignStatus(["APPROVED", "SCHEDULED"]), "SCHEDULED");
  assert.equal(deriveCampaignStatus(["PUBLISHED", "ARCHIVED"]), "PUBLISHED");
  assert.equal(deriveCampaignStatus(["PUBLISHED", "NEEDS_REVIEW"]), "IN_REVIEW");
  assert.equal(deriveCampaignStatus(["FAILED", "DRAFT"]), "ATTENTION");
});

test("content changes revoke approval but schedule changes preserve it", () => {
  assert.equal(contentEditState("APPROVED"), "NEEDS_REVIEW");
  assert.equal(contentEditState("SCHEDULED"), "NEEDS_REVIEW");
  assert.equal(scheduleState("APPROVED", new Date()), "SCHEDULED");
  assert.equal(scheduleState("SCHEDULED", new Date()), "SCHEDULED");
  assert.throws(() => scheduleState("DRAFT", new Date()), /approved/);
});

test("due scheduled posts become ready but never published", () => {
  const now = new Date("2026-07-28T16:00:00Z");
  assert.equal(readyState("SCHEDULED", new Date("2026-07-28T15:59:00Z"), now), "READY_TO_PUBLISH");
  assert.equal(readyState("SCHEDULED", new Date("2026-07-28T16:01:00Z"), now), "SCHEDULED");
});

test("approval requires copy and media where applicable", () => {
  assert.equal(canApprove({ caption: "A useful post", postType: "TEXT_POST", mediaCount: 0 }), true);
  assert.equal(canApprove({ caption: "A useful post", postType: "REEL", mediaCount: 0 }), false);
  assert.equal(canApprove({ caption: "", postType: "IMAGE_POST", mediaCount: 1 }), false);
});

test("media checks are non-destructive recommendations", () => {
  assert.match(mediaWarning({ postType: "REEL", mimeType: "image/jpeg" }) || "", /video/);
  assert.match(mediaWarning({ postType: "REEL", mimeType: "video/mp4", aspectRatio: 1.77 }) || "", /9:16/);
});

test("verified AI facts discard nested instructions", () => {
  assert.deepEqual(sanitizedVerifiedFacts({ title: "Eaton Farm", bedrooms: 4, private: { prompt: "invent" } }), {
    title: "Eaton Farm", bedrooms: 4,
  });
});
