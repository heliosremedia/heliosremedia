import assert from "node:assert/strict";
import test from "node:test";
import { getProjectProgressState } from "./project-progress.ts";

test("project progress reflects authoritative saved readiness", () => {
  assert.deepEqual(getProjectProgressState({ hasSummary: false, hasPlayableVideo: false, mediaCount: 0, serviceCount: 0, status: "DRAFT" }), {
    detailsReady: false,
    mediaReady: false,
    servicesReady: false,
    publishReady: false,
  });
  assert.deepEqual(getProjectProgressState({ hasSummary: true, hasPlayableVideo: false, mediaCount: 1, serviceCount: 2, status: "PUBLISHED" }), {
    detailsReady: true,
    mediaReady: true,
    servicesReady: true,
    publishReady: true,
  });
  assert.equal(getProjectProgressState({ hasSummary: false, hasPlayableVideo: true, mediaCount: 0, serviceCount: 0, status: "ARCHIVED" }).detailsReady, true);
});
