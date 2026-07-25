import assert from "node:assert/strict";
import test from "node:test";
import {
  generationDateForSend,
  occurrenceForMonth,
  zonedLocalDateToUtc,
} from "./recurrence.ts";

test("Denver recurrence respects winter and summer offsets", () => {
  assert.equal(
    occurrenceForMonth(2027, 1, { kind: "NTH_WEEKDAY", ordinal: "SECOND", weekday: 4, localTime: "09:00" }).toISOString(),
    "2027-01-14T16:00:00.000Z",
  );
  assert.equal(
    occurrenceForMonth(2027, 7, { kind: "NTH_WEEKDAY", ordinal: "SECOND", weekday: 4, localTime: "09:00" }).toISOString(),
    "2027-07-08T15:00:00.000Z",
  );
});

test("day 31 clamps to a short month", () => {
  assert.equal(
    occurrenceForMonth(2027, 2, { kind: "DAY_OF_MONTH", dayOfMonth: 31, localTime: "09:00" }).toISOString(),
    "2027-02-28T16:00:00.000Z",
  );
});

test("DST gap advances to the first valid wall-clock minute", () => {
  assert.equal(
    zonedLocalDateToUtc({ year: 2027, month: 3, day: 14, hour: 2, minute: 30, timeZone: "America/Denver" }).toISOString(),
    "2027-03-14T09:00:00.000Z",
  );
});

test("generation can be calculated independently before send", () => {
  const send = new Date("2027-08-12T15:00:00.000Z");
  assert.equal(
    generationDateForSend(send, { mode: "DAYS_BEFORE_SEND", daysBeforeSend: 7, localTime: "08:00" })?.toISOString(),
    "2027-08-05T14:00:00.000Z",
  );
});
