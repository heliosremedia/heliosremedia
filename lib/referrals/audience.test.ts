import test from "node:test";
import assert from "node:assert/strict";
import { resolveAudience } from "./audience.ts";

const clients = [
  { id: "a", normalizedEmail: "a@example.com", emailSubscribed: true, archivedAt: null, emailStatus: "VALID" },
  { id: "b", normalizedEmail: "a@example.com", emailSubscribed: true, archivedAt: null, emailStatus: "VALID" },
  { id: "c", normalizedEmail: "c@example.com", emailSubscribed: false, archivedAt: null, emailStatus: "VALID" },
];

test("audiences deduplicate by email and explain exclusions", () => {
  const result = resolveAudience(clients, {
    mode: "ALL_ELIGIBLE", selectedClientIds: [], selectedGroupClientIds: [], excludedClientIds: [],
  });
  assert.equal(result.eligible.length, 1);
  assert.equal(result.excluded[0]?.reasons[0], "Unsubscribed");
});

test("an empty implicit audience is rejected", () => {
  assert.throws(() => resolveAudience(clients, {
    mode: "INDIVIDUALS", selectedClientIds: [], selectedGroupClientIds: [], excludedClientIds: [],
  }), /specific audience/);
});

test("a pre-filtered candidate set is treated as the explicit dynamic audience", () => {
  const result = resolveAudience(clients, {
    mode: "FILTERED", selectedClientIds: [], selectedGroupClientIds: [], excludedClientIds: [],
  });
  assert.equal(result.eligible.length, 1);
  assert.equal(result.excluded.length, 1);
});
