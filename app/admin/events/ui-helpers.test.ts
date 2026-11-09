import test from "node:test";
import assert from "node:assert/strict";
import { displayDate, localDateTime, responseCounts } from "./ui-helpers.ts";
import { zonedLocalToUtc } from "../../../lib/client-communications/scheduling.ts";

test("unspecified dates remain blank rather than fabricating a date", () => {
  assert.equal(localDateTime(null, "America/Denver"), "");
  assert.equal(displayDate(null, "America/Denver"), "Date not set");
});
test("event editor round-trips the chosen timezone, independent of browser timezone", () => {
  for (const iso of ["2027-01-15T16:00:00.000Z", "2027-07-15T15:00:00.000Z"]) {
    const local = localDateTime(iso, "America/Denver");
    assert.equal(local.slice(11), "09:00");
    assert.equal(zonedLocalToUtc(local, "America/Denver").toISOString(), iso);
  }
});
test("RSVP summary counts explicit yes/no and pending separately", () => {
  assert.deepEqual(responseCounts([{ response: "YES" }, { response: "NO" }, { response: "YES" }, { response: "PENDING" }]), { total: 4, yes: 2, no: 1, pending: 1 });
  assert.deepEqual(responseCounts(), { total: 0, yes: 0, no: 0, pending: 0 });
});
