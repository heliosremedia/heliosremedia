import assert from "node:assert/strict";
import test from "node:test";
import { campaignWorkspacePreferenceToken, validWorkspacePreferenceToken, workspacePreferenceTokenHash } from "./client-communications/workspace-token-rules.ts";
import { validPreferenceTokenFormat } from "./client-communications/preference-rules.ts";
const input = { workspaceId: "a", campaignId: "campaign", recipientId: "recipient", normalizedEmail: "same@example.test", signingSecret: "synthetic-signing-secret-with-at-least-32-characters" };
test("workspace tokens remain stable for a delivery retry and are disjoint from legacy tokens", () => {
  const token = campaignWorkspacePreferenceToken(input); assert.equal(campaignWorkspacePreferenceToken(input),token);
  assert.equal(validWorkspacePreferenceToken(token),true); assert.equal(validPreferenceTokenFormat(token),false);
  assert.match(workspacePreferenceTokenHash(token),/^[a-f0-9]{64}$/); assert.doesNotMatch(token,/same@example|campaign|recipient/);
});
test("company, campaign, recipient and address each separate the token namespace", () => {
  const token = campaignWorkspacePreferenceToken(input);
  for(const key of ["workspaceId","campaignId","recipientId","normalizedEmail"] as const) assert.notEqual(campaignWorkspacePreferenceToken({...input,[key]:"different"}),token);
});
test("legacy, malformed and short tokens are not accepted as workspace tokens", () => {
  for(const token of ["a".repeat(43),"v2."+"a".repeat(42),"v2."+"a".repeat(44),"v2."+"!".repeat(43),"", "v2."+"a".repeat(43)+"\n"]) assert.equal(validWorkspacePreferenceToken(token),false);
});
test("workspace token signing fails closed without a configured strong secret", () => {
  for(const signingSecret of ["","short"," ".repeat(40)]) assert.throws(()=>campaignWorkspacePreferenceToken({...input,signingSecret}),/CONSENT_TOKEN_CONFIGURATION_REQUIRED/);
});
