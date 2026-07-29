import assert from "node:assert/strict";
import test from "node:test";
import { getStudioRelease, STUDIO_RELEASES } from "./releases.ts";
import { STUDIO_VERSION, STUDIO_VERSION_HREF } from "./version.ts";

test("visible version links to the matching code-controlled release", () => {
  assert.equal(STUDIO_VERSION, "V1.8.9.16");
  assert.equal(STUDIO_VERSION_HREF, "/admin/release-notes/v1-8-9-16");
  assert.equal(getStudioRelease("v1-8-9-16")?.version, STUDIO_VERSION);
  assert.equal(getStudioRelease("v1-8-9-16")?.status, "LIVE");
  assert.equal(getStudioRelease("v1-8-9-16")?.releaseDate, "2026-07-29");
  for (const hidden of ["v1-8-9-6", "v1-8-9-7", "v1-8-9-8", "v1-8-9-9", "v1-8-9-10", "v1-8-9-11", "v1-8-9-12", "v1-8-9-13"]) {
    assert.equal(getStudioRelease(hidden), null);
  }
  for (const version of ["V1.8.7", "V1.8.7.1"]) {
    const release = STUDIO_RELEASES.find(item => item.version === version);
    assert.equal(release?.status, "LIVE");
    assert.equal(release?.releaseDate, "2026-07-27");
  }
  assert.equal(getStudioRelease("unknown"), null);
  assert.equal(STUDIO_RELEASES.every(release => Boolean(release.title && release.summary)), true);
});
