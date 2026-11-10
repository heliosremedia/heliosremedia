import test from "node:test";
import assert from "node:assert/strict";
import { initialAdditionalGuests, initialRsvpChoice, MAX_ADDITIONAL_GUESTS, parseAdditionalGuests, readRsvpFragment, rsvpPartySummary } from "../../events/rsvp/response-helpers.ts";
import { readFileSync } from "node:fs";

test("email links preselect only an allowlisted response while preserving the private token", () => {
  for (const choice of ["YES", "NO", "MAYBE"]) assert.deepEqual(readRsvpFragment(`#token=private-token&response=${choice}`), { token: "private-token", choice });
  assert.equal(readRsvpFragment("#token=private-token&response=DELETE").choice, "");
  assert.equal(initialRsvpChoice("MAYBE", "YES"), "MAYBE");
  assert.equal(initialRsvpChoice("", "MAYBE"), "MAYBE");
  assert.equal(initialRsvpChoice("invalid", "PENDING"), "");
});

test("public invitation retains explicit submission and no-referrer image/link privacy", () => {
  const source = readFileSync(new URL("../../events/rsvp/RsvpResponse.tsx", import.meta.url), "utf8");
  const effect = source.slice(source.indexOf("  useEffect("), source.indexOf("  async function submit()"));
  assert.doesNotMatch(effect, /method: "POST"/);
  assert.match(effect, /window.history.replaceState/);
  assert.match(source, /onSubmit=.*void submit\(\)/);
  assert.match(source, /<img[^>]+referrerPolicy="no-referrer"/);
  assert.match(source, /href=\{invitation.event.venueUrl\}[^>]+rel="noopener noreferrer"[^>]+referrerPolicy="no-referrer"/);
  assert.match(source, /value: "MAYBE"/);
});

test("email preview is sandboxed and stage cannot change during an in-flight preview", () => {
  const source = readFileSync(new URL("./EventStudio.tsx", import.meta.url), "utf8");
  assert.match(source, /<select className=\{input\} disabled=\{busy\} value=\{stage\}/);
  assert.match(source, /<iframe[^>]+sandbox=""[^>]+referrerPolicy="no-referrer"/);
  assert.match(source, /previewWidth === "MOBILE" \? 375 : 760/);
});

test("guest counts initialize safely for existing and legacy invitations", () => {
  for (const response of ["YES", "MAYBE"]) {
    assert.equal(initialAdditionalGuests(response, 3), "3");
    for (const value of [undefined, null, "2", -1, 1.5, 100, NaN, Infinity]) assert.equal(initialAdditionalGuests(response, value), "0");
  }
  for (const response of ["NO", "PENDING", ""]) assert.equal(initialAdditionalGuests(response, 3), "0");
});

test("guest-count input accepts whole numbers only and a decline always clears the count", () => {
  assert.equal(MAX_ADDITIONAL_GUESTS, 99);
  for (const response of ["YES", "MAYBE"] as const) {
    for (const value of ["0", "1", "2", "99"]) assert.equal(parseAdditionalGuests(response, value), Number(value));
    for (const value of ["", " ", "-1", "1.5", "100", "1e1", "NaN", "Infinity", "1 guest"]) assert.equal(parseAdditionalGuests(response, value), null);
  }
  assert.equal(parseAdditionalGuests("", "0"), null);
  assert.equal(parseAdditionalGuests("NO", "2"), 0);
  assert.equal(parseAdditionalGuests("NO", "invalid"), 0);
});

test("public party summaries include the invitee and distinguish tentative attendance", () => {
  assert.equal(rsvpPartySummary("YES", 0), "Your party: 1 person (just you).");
  assert.equal(rsvpPartySummary("YES", 1), "Your party: 2 people (you + 1 guest).");
  assert.equal(rsvpPartySummary("YES", 4), "Your party: 5 people (you + 4 guests).");
  assert.equal(rsvpPartySummary("MAYBE", 2), "Tentative party: 3 people (you + 2 guests).");
  assert.equal(rsvpPartySummary("YES", undefined), "Your party: 1 person (just you).");
  assert.equal(rsvpPartySummary("NO", 4), "");
  assert.equal(rsvpPartySummary("PENDING", 4), "");
});
