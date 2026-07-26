import assert from "node:assert/strict";
import test from "node:test";
import { nextBlogSeriesDates } from "./blog-series-schedule.ts";

test("weekly and biweekly series advance without publishing automatically", () => {
  const start = new Date("2026-08-14T15:00:00.000Z");
  assert.equal(nextBlogSeriesDates("WEEKLY", start, 7).nextPublishAt.toISOString(), "2026-08-21T15:00:00.000Z");
  assert.equal(nextBlogSeriesDates("BIWEEKLY", start, 7).nextPublishAt.toISOString(), "2026-08-28T15:00:00.000Z");
  assert.equal(nextBlogSeriesDates("BIWEEKLY", start, 7).nextGenerationAt.toISOString(), "2026-08-21T15:00:00.000Z");
});

test("monthly series advances by calendar month", () => {
  const result = nextBlogSeriesDates("MONTHLY", new Date("2026-08-14T15:00:00.000Z"), 10);
  assert.equal(result.nextPublishAt.toISOString(), "2026-09-14T15:00:00.000Z");
  assert.equal(result.nextGenerationAt.toISOString(), "2026-09-04T15:00:00.000Z");
  assert.equal(
    nextBlogSeriesDates("MONTHLY", new Date("2027-01-31T15:00:00.000Z"), 7).nextPublishAt.toISOString(),
    "2027-02-28T15:00:00.000Z",
  );
});
