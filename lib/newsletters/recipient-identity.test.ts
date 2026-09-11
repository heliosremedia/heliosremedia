import assert from "node:assert/strict";
import test from "node:test";
import { newsletterRecipientIdentity } from "./recipient-identity.ts";
test("retry eligibility cannot transfer between clients sharing an email address", () => {
  const eligible = new Set([newsletterRecipientIdentity("owned", "client@example.com")]);
  assert.equal(eligible.has(newsletterRecipientIdentity("owned", " Client@Example.com ")), true);
  assert.equal(eligible.has(newsletterRecipientIdentity("foreign", "client@example.com")), false);
  assert.equal(eligible.has(newsletterRecipientIdentity(null, "client@example.com")), false);
});
