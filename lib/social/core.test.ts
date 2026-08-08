import assert from "node:assert/strict";
import test from "node:test";
import {
  canApprove, contentEditState, deriveCampaignStatus, mediaWarning, normalizeAiCampaignBrief, readyState, recurrenceDates, scheduleState, sanitizedVerifiedFacts,
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
  assert.throws(() => contentEditState("PUBLISHED"), /immutable/);
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
  assert.equal(canApprove({ caption: "A useful post", postType: "IMAGE_POST", mediaCount: 0, hasGeneratedCover: true }), true);
  assert.equal(canApprove({ caption: "", postType: "IMAGE_POST", mediaCount: 1, hasGeneratedCover: true }), false);
});

test("media checks are non-destructive recommendations", () => {
  assert.match(mediaWarning({ postType: "REEL", mimeType: "image/jpeg" }) || "", /video/);
  assert.match(mediaWarning({ postType: "REEL", mimeType: "video/mp4", aspectRatio: 1.77 }) || "", /9:16/);
});

test("verified AI facts discard nested instructions", () => {
  assert.deepEqual(sanitizedVerifiedFacts({ sourceId: "internal", slug: "eaton-farm", title: "Eaton Farm", bedrooms: 4, private: { prompt: "invent" } }), {
    title: "Eaton Farm", bedrooms: 4,
  });
});

test("series recurrence is deterministic and retry-safe at its source", () => {
  const weekly = recurrenceDates({
    startsAt: new Date("2026-08-01T00:00:00"),
    through: new Date("2026-08-31T23:59:59"),
    frequency: "WEEKLY",
    interval: 1,
    dayOfWeek: 2,
    hour: 9,
    minute: 30,
  });
  assert.deepEqual(weekly.map((value) => value.getDate()), [4, 11, 18, 25]);
  assert.equal(new Set(weekly.map((value) => value.toISOString())).size, weekly.length);

  const monthly = recurrenceDates({
    startsAt: new Date("2026-01-31T00:00:00"),
    through: new Date("2026-04-30T23:59:59"),
    frequency: "MONTHLY",
    interval: 1,
    dayOfMonth: 31,
    hour: 8,
    minute: 0,
  });
  assert.deepEqual(monthly.map((value) => [value.getMonth() + 1, value.getDate()]), [[1, 31], [2, 28], [3, 31], [4, 30]]);
});

test("AI campaign briefs require bounded structured output", () => {
  assert.equal(normalizeAiCampaignBrief({ positioning: "A useful direction", themes: [] }), null);
  assert.deepEqual(normalizeAiCampaignBrief({
    positioning: "Lead with the craft behind the listing.",
    themes: ["Photography", "Process"],
    cadence: "Twice weekly",
    formats: ["Carousel"],
    platformConsiderations: "Adapt the opening for each platform.",
    callsToAction: "Explore the project.",
    ignored: { claim: "fabricated" },
  }), {
    positioning: "Lead with the craft behind the listing.",
    themes: ["Photography", "Process"],
    cadence: "Twice weekly",
    formats: ["Carousel"],
    platformConsiderations: "Adapt the opening for each platform.",
    callsToAction: "Explore the project.",
  });
});
