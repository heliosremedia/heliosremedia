import assert from "node:assert/strict";
import test from "node:test";
import { parseLegacyContributorIdentity } from "./contributor-identity.ts";

test("legacy contributor identity splits only unambiguous values", () => {
  assert.deepEqual(parseLegacyContributorIdentity("Jake Guerin - Owner/Photographer"), {
    status: "migratable", displayName: "Jake Guerin", title: "Owner/Photographer",
  });
  assert.equal(parseLegacyContributorIdentity("Name - Title - Extra").status, "review");
  assert.equal(parseLegacyContributorIdentity("Name", "Existing title").status, "unchanged");
});
