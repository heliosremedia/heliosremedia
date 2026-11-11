import assert from "node:assert/strict";
import test from "node:test";
import { assertFeedbackOrigin, feedbackAudience, feedbackEditableBody, feedbackEmailBody, feedbackRowVersion, feedbackUuid, FEEDBACK_REQUIRED_FOOTER, FEEDBACK_SURVEY, newFeedbackDraft } from "./feedback.ts";

test("feedback defaults use the existing form without revealing its completion reward", () => {
  const draft = newFeedbackDraft();
  assert.equal(draft.mode, "ORIGINAL");
  assert.doesNotMatch(draft.body, /FEEDBACK50|\$50/);
  assert.equal(FEEDBACK_SURVEY.originalCampaignId, "cmw9mxgiz00eu08l9d2ah46fd");
  assert.match(FEEDBACK_SURVEY.formUrl, /\/viewform$/);
  assert.match(FEEDBACK_SURVEY.resultsUrl, /\/edit#responses$/);
});

test("every reminder gets the immutable form link and already-completed acknowledgement exactly once", () => {
  const canonical = feedbackEmailBody("Hello");
  assert.ok(canonical.endsWith(FEEDBACK_REQUIRED_FOOTER));
  assert.equal(feedbackEmailBody(canonical), canonical);
  assert.equal(feedbackEditableBody(canonical), "Hello");
  assert.equal(feedbackEditableBody(`${canonical}\n\n${FEEDBACK_REQUIRED_FOOTER}`), "Hello");
  assert.ok(feedbackEmailBody("[Survey](https://example.com)").endsWith(FEEDBACK_REQUIRED_FOOTER));
});

test("audiences select original, groups, individuals and all, deduplicating normalized email", () => {
  const clients = [
    { id: "a", email: "Alice@example.com", displayName: "Alice", groupIds: ["g1"], isOriginalRecipient: true },
    { id: "b", email: "bob@example.com", displayName: "Bob", groupIds: ["g2"], isOriginalRecipient: false },
    { id: "c", email: "alice@example.com", displayName: "Alice duplicate", groupIds: ["g2"], isOriginalRecipient: false },
  ];
  const select = (mode: "ALL" | "ORIGINAL" | "GROUPS" | "INDIVIDUALS", groupIds: string[] = [], clientIds: string[] = []) => feedbackAudience(clients, { mode, groupIds, clientIds }).map((row) => row.id);
  assert.deepEqual(select("ORIGINAL"), ["a"]);
  assert.deepEqual(select("ALL"), ["c", "b"]);
  assert.deepEqual(select("GROUPS", ["g2"]), ["b", "c"]);
  assert.deepEqual(select("INDIVIDUALS", [], ["b", "foreign"]), ["b"]);
  assert.deepEqual(select("GROUPS"), []);
});

test("same-origin write guard rejects missing, null and foreign origins", () => {
  const url = "https://studio.example.com/api/admin/feedback";
  for (const origin of [undefined, "null", "https://evil.example", "https://studio.example.com.evil.example"]) {
    assert.throws(() => assertFeedbackOrigin(new Request(url, { headers: origin ? { origin } : {} })), /Open Feedback/);
  }
  assert.doesNotThrow(() => assertFeedbackOrigin(new Request(url, { headers: { origin: "https://studio.example.com" } })));
  assert.throws(() => assertFeedbackOrigin(new Request(url, { headers: { origin: "https://studio.example.com", "sec-fetch-site": "cross-site" } })), /Open Feedback/);
});

test("create ids and optimistic versions fail closed", () => {
  assert.equal(feedbackUuid("457BE3A0-1B43-45BA-9551-8F93EEA1E815"), "457be3a0-1b43-45ba-9551-8f93eea1e815");
  for (const value of ["bad", undefined, "original-campaign"]) assert.throws(() => feedbackUuid(value));
  for (const value of [undefined, 0, -1, "1", 1.1]) assert.throws(() => feedbackRowVersion(value));
  assert.equal(feedbackRowVersion(4), 4);
});
