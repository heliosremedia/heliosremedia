import assert from "node:assert/strict";
import test from "node:test";
import { getProjectProgressState } from "./project-progress.ts";

test("project progress reflects authoritative saved readiness", () => {
  assert.deepEqual(getProjectProgressState({ hasSummary: false, hasPlayableVideo: false, hasLeadMedia: false, mediaCount: 0, serviceCount: 0, status: "DRAFT" }), {
    detailsReady: false,
    mediaReady: false,
    servicesReady: false,
    publishReady: false,
  });
  assert.deepEqual(getProjectProgressState({ hasSummary: true, hasPlayableVideo: false, hasLeadMedia: true, mediaCount: 1, serviceCount: 2, status: "PUBLISHED" }), {
    detailsReady: true,
    mediaReady: true,
    servicesReady: true,
    publishReady: true,
  });
  assert.equal(getProjectProgressState({ hasSummary: false, hasPlayableVideo: true, hasLeadMedia: false, mediaCount: 0, serviceCount: 0, status: "ARCHIVED" }).detailsReady, true);
});


test("media completion follows the publishing checklist, not merely asset count", () => {
  const base = { hasSummary: true, hasPlayableVideo: false, hasLeadMedia: false, mediaCount: 47, serviceCount: 0, status: "DRAFT" };
  assert.equal(getProjectProgressState(base).mediaReady, false);
  assert.equal(getProjectProgressState({ ...base, hasLeadMedia: true }).mediaReady, true);
  assert.equal(getProjectProgressState({ ...base, hasPlayableVideo: true }).mediaReady, true);
  assert.equal(getProjectProgressState({ ...base, hasLeadMedia: true, mediaCount: 0 }).mediaReady, false);
  assert.equal(getProjectProgressState(base).servicesReady, false);
});


test("published status does not mark an incomplete project complete", () => {
  const complete = { hasSummary: true, hasPlayableVideo: false, hasLeadMedia: true, mediaCount: 2, serviceCount: 1, status: "PUBLISHED" };
  assert.equal(getProjectProgressState(complete).publishReady, true);
  for (const missing of [{ hasSummary: false }, { hasLeadMedia: false }, { mediaCount: 0 }, { serviceCount: 0 }]) {
    assert.equal(getProjectProgressState({ ...complete, ...missing }).publishReady, false);
  }
  assert.equal(getProjectProgressState({ ...complete, status: "DRAFT" }).publishReady, false);
});
