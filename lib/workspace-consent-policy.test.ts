import assert from "node:assert/strict";
import test from "node:test";
import { workspaceMarketingEligibility } from "./client-communications/workspace-consent-policy.ts";

for (const companyStatus of [null, "UNKNOWN", "PENDING_CONFIRMATION", "UNSUBSCRIBED", "SUBSCRIBED"]) {
  test(`company ${companyStatus} cannot override a legacy opt-out or safety block`, () => {
    for (const legacyStatus of ["UNSUBSCRIBED", "SUPPRESSED"]) assert.deepEqual(workspaceMarketingEligibility({ companyStatus, legacyStatus, safetySuppressed: false }), { eligible: false, reason: "PROTECTED_BLOCK" });
    assert.deepEqual(workspaceMarketingEligibility({ companyStatus, legacyStatus: "SUBSCRIBED", safetySuppressed: true }), { eligible: false, reason: "PROTECTED_BLOCK" });
  });
  test(`company ${companyStatus} requires its own subscription independently of legacy approval`, () => {
    for (const legacyStatus of [null, "UNKNOWN", "PENDING_CONFIRMATION", "SUBSCRIBED"]) assert.equal(workspaceMarketingEligibility({ companyStatus, legacyStatus, safetySuppressed: false }).eligible, companyStatus === "SUBSCRIBED");
  });
}
