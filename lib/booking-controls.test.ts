import assert from "node:assert/strict";
import test from "node:test";
import { movePinnedItem, resolveBookingDestination } from "./booking-controls.ts";
import { publicHealthResponse } from "./health.ts";
import { normalizeMonitorStatus } from "./uptimerobot-core.ts";
import { STUDIO_ADMIN_LABEL, STUDIO_VERSION } from "./version.ts";

test("booking outages and pauses never redirect externally", () => {
  assert.equal(resolveBookingDestination("UNAVAILABLE", "https://booking.example.com").kind, "status");
  assert.equal(resolveBookingDestination("PAUSED", "https://booking.example.com").href, "/book");
});

test("online booking redirects only to valid HTTP destinations", () => {
  assert.equal(resolveBookingDestination("ONLINE", "https://booking.example.com").kind, "handoff");
  assert.equal(resolveBookingDestination("ONLINE", "javascript:alert(1)").kind, "status");
  assert.equal(resolveBookingDestination("ONLINE", null).kind, "status");
});

test("keyboard pinned navigation reordering preserves every stable identifier", () => {
  assert.deepEqual(movePinnedItem(["email", "blog", "referrals"], "blog", -1), ["blog", "email", "referrals"]);
  assert.deepEqual(movePinnedItem(["email", "blog"], "email", -1), ["email", "blog"]);
});

test("V1.8.4 operational controls fail safely and expose no diagnostics", () => {
  assert.equal(STUDIO_VERSION, "V.1.8.5");
  assert.equal(STUDIO_ADMIN_LABEL, "STUDIO ADMIN — V.1.8.5");
  assert.equal(normalizeMonitorStatus("up"), "ONLINE");
  assert.equal(normalizeMonitorStatus("seems_down"), "DEGRADED");
  assert.equal(normalizeMonitorStatus("down"), "OFFLINE");
  assert.equal(normalizeMonitorStatus("unexpected"), "UNKNOWN");
  const result = publicHealthResponse({ publicSite: true, bookingRoute: true, bookingDestination: false }, new Date("2026-07-27T12:00:00Z"));
  assert.deepEqual(result, { status: "operational", timestamp: "2026-07-27T12:00:00.000Z" });
  assert.equal("bookingDestination" in result, false);
});
