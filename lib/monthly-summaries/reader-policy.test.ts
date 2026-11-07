import assert from "node:assert/strict";
import test from "node:test";
import { useLegacySummaryReader, summaryClientScope } from "./reader-policy.ts";

test("V3 wins when the client portal still has its legacy key", () => {
  assert.equal(useLegacySummaryReader({ HDPH_API_KEY: "legacy", HDPH_V3_TOKEN: "v3" }), false);
  assert.equal(useLegacySummaryReader({ HDPH_API_KEY: "legacy" }), true);
  assert.equal(useLegacySummaryReader({}), false);
});

test("a resumed legacy scan cannot narrow V3 monthly client matching", () => {
  assert.deepEqual(summaryClientScope(false, undefined, "old-cursor"), {});
  assert.deepEqual(summaryClientScope(true, undefined, "old-cursor"), { id: { gt: "old-cursor" } });
  assert.deepEqual(summaryClientScope(true, "client", "old-cursor"), { id: "client" });
});
