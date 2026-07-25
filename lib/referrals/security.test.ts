import test from "node:test";
import assert from "node:assert/strict";
import { validateReferralCampaignDraft } from "./ai.ts";
import { isReferralAdministrator } from "./permissions.ts";
import { createReferralCredentials, hashReferralToken } from "./tokens.ts";

test("only owner and admin roles can operate Referral Studio", () => {
  assert.equal(isReferralAdministrator("OWNER"), true);
  assert.equal(isReferralAdministrator("ADMIN"), true);
  assert.equal(isReferralAdministrator("EDITOR"), false);
  assert.equal(isReferralAdministrator("VIEWER"), false);
  assert.equal(isReferralAdministrator(null), false);
});

test("referral tokens and codes are random, opaque, and non-sequential", () => {
  const generated = Array.from({ length: 100 }, () => createReferralCredentials());
  assert.equal(new Set(generated.map(item => item.token)).size, 100);
  assert.equal(new Set(generated.map(item => item.code)).size, 100);
  assert.ok(generated.every(item => /^HEL-[A-HJ-NP-Z2-9]{8}$/.test(item.code)));
  assert.ok(generated.every(item => item.tokenHash === hashReferralToken(item.token) && !item.tokenHash.includes(item.token)));
});

test("AI structured output is length-limited and requires every campaign field", () => {
  const valid = {
    publicTitle: "Share Helios", campaignConcept: "A thoughtful introduction.",
    referralOfferSuggestions: ["Administrator must enter confirmed offer."],
    invitationSubject: "A thoughtful introduction", invitationBody: "Invitation",
    followUpBody: "Follow up", landingHeadline: "Introduce someone",
    landingBody: "Landing copy", referralConfirmation: "Thank you",
    advocateThankYou: "Thank you", rewardNotification: "Reward update",
    termsSummary: "Terms", suggestedAudience: "Eligible established clients",
    suggestedFollowUpDays: 7, warnings: ["Confirm the commercial offer."],
  };
  assert.equal(validateReferralCampaignDraft(valid).suggestedFollowUpDays, 7);
  assert.throws(() => validateReferralCampaignDraft({ ...valid, invitationSubject: "" }), /invalid invitation subject/);
  assert.throws(() => validateReferralCampaignDraft({ ...valid, landingBody: "x".repeat(8_001) }), /invalid landing body/);
});
