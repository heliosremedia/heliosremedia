import test from "node:test";
import assert from "node:assert/strict";
import { initialRsvpChoice, readRsvpFragment } from "../../events/rsvp/response-helpers.ts";
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
