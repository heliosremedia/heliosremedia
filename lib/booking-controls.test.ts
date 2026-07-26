import assert from "node:assert/strict";
import test from "node:test";
import { movePinnedItem, resolveBookingDestination } from "./booking-controls.ts";

test("booking outages and pauses never redirect externally", () => {
  assert.equal(resolveBookingDestination("UNAVAILABLE", "https://booking.example.com").kind, "status");
  assert.equal(resolveBookingDestination("PAUSED", "https://booking.example.com").href, "/book");
});

test("online booking redirects only to valid HTTP destinations", () => {
  assert.equal(resolveBookingDestination("ONLINE", "https://booking.example.com").kind, "redirect");
  assert.equal(resolveBookingDestination("ONLINE", "javascript:alert(1)").kind, "status");
  assert.equal(resolveBookingDestination("ONLINE", null).kind, "status");
});

test("keyboard pinned navigation reordering preserves every stable identifier", () => {
  assert.deepEqual(movePinnedItem(["email", "blog", "referrals"], "blog", -1), ["blog", "email", "referrals"]);
  assert.deepEqual(movePinnedItem(["email", "blog"], "email", -1), ["email", "blog"]);
});
