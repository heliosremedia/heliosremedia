import assert from "node:assert/strict";
import test from "node:test";
import { getStudioRelease, STUDIO_RELEASES } from "./releases.ts";
import { STUDIO_VERSION, STUDIO_VERSION_HREF } from "./version.ts";

test("visible version links to the matching code-controlled release", () => {
  assert.equal(STUDIO_VERSION, "V1.8.9.2");
  assert.equal(STUDIO_VERSION_HREF, "/admin/release-notes/v1-8-9-2");
  assert.equal(getStudioRelease("v1-8-9-2")?.version, STUDIO_VERSION);
  assert.equal(getStudioRelease("v1-8-9-2")?.status, "LIVE");
  assert.equal(getStudioRelease("v1-8-9-2")?.releaseDate, "2026-07-28");
  for (const version of ["V1.8.7", "V1.8.7.1"]) {
    const release = STUDIO_RELEASES.find(item => item.version === version);
    assert.equal(release?.status, "LIVE");
    assert.equal(release?.releaseDate, "2026-07-27");
  }
  assert.equal(getStudioRelease("unknown"), null);
  assert.equal(STUDIO_RELEASES.every(release => Boolean(release.title && release.summary)), true);
});
