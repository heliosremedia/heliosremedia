import assert from "node:assert/strict";
import test from "node:test";
import { getStudioRelease, STUDIO_RELEASES } from "./releases.ts";
import { STUDIO_VERSION, STUDIO_VERSION_HREF } from "./version.ts";

test("visible version links to the matching code-controlled release", () => {
  assert.equal(STUDIO_VERSION, "V1.8.7.1");
  assert.equal(STUDIO_VERSION_HREF, "/admin/release-notes/v1-8-7-1");
  assert.equal(getStudioRelease("v1-8-7-1")?.version, STUDIO_VERSION);
  assert.equal(getStudioRelease("unknown"), null);
  assert.equal(STUDIO_RELEASES.every(release => Boolean(release.title && release.summary)), true);
});
