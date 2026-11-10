import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAdditionalGuestCount, MAX_ADDITIONAL_GUESTS, resolveAdditionalGuests } from "./guest-counts.ts";

test("additional guests are whole numbers from zero through the configured limit", () => {
  for (const count of [0, 1, 2, 10, MAX_ADDITIONAL_GUESTS]) assert(isAdditionalGuestCount(count));
  for (const count of [-1, 0.1, 1.5, MAX_ADDITIONAL_GUESTS + 1, NaN, Infinity, -Infinity, "0", "2", "", null, undefined, true, false, [], {}, Number.MAX_SAFE_INTEGER]) {
    assert.equal(isAdditionalGuestCount(count), false, String(count));
  }
});

test("Yes and Maybe store zero, one or multiple guests while No always clears the party", () => {
  for (const response of ["YES", "MAYBE"] as const) {
    for (const count of [0, 1, 3, MAX_ADDITIONAL_GUESTS]) assert.equal(resolveAdditionalGuests(response, count, 7), count);
  }
  for (const count of [undefined, 0, 1, 3, MAX_ADDITIONAL_GUESTS]) assert.equal(resolveAdditionalGuests("NO", count, 7), 0);
});

test("an old client's omitted count preserves existing guests for Yes and Maybe", () => {
  for (const response of ["YES", "MAYBE"] as const) {
    assert.equal(resolveAdditionalGuests(response, undefined), 0);
    assert.equal(resolveAdditionalGuests(response, undefined, 4), 4);
    assert.equal(resolveAdditionalGuests(response, 0, 4), 0);
  }
});

test("malformed counts are rejected even on No instead of being coerced or ignored", () => {
  for (const response of ["YES", "NO", "MAYBE"] as const) {
    for (const count of [-1, 1.5, MAX_ADDITIONAL_GUESTS + 1, "2", null, false, {}, [], NaN, Infinity]) {
      assert.throws(() => resolveAdditionalGuests(response, count, 4), /whole number/);
    }
  }
});

test("guest migration is additive with a zero default and database bounds", () => {
  const migration = readFileSync(new URL("../../prisma/migrations/20261110150000_event_invitation_guest_counts/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN "additionalGuests" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /"additionalGuests" BETWEEN 0 AND 99/);
  assert.match(migration, /"response" IN \('YES', 'MAYBE'\) OR "additionalGuests" = 0/);
  assert.doesNotMatch(migration, /\b(?:DELETE|DROP|TRUNCATE)\b/i);
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const invitation = schema.split("model EventInvitation {")[1].split("\n}")[0];
  assert.match(invitation, /additionalGuests\s+Int\s+@default\(0\)/);
});
