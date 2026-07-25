import assert from "node:assert/strict";
import test from "node:test";
import { updateSeriesActive } from "../../app/admin/newsletter-studio/components/dashboard-state.ts";
import {
  NEWSLETTER_CTA,
  NEWSLETTER_CTA_EMAIL_STYLE,
  renderNewsletterCta,
  shouldExecuteNewsletterJob,
  testEmailSubject,
} from "./presentation.ts";

test("newsletter CTA presentation matches in preview and email-safe markup", () => {
  assert.deepEqual(NEWSLETTER_CTA, {
    backgroundColor: "#c85f28",
    color: "#ffffff",
    textDecoration: "none",
  });
  assert.match(NEWSLETTER_CTA_EMAIL_STYLE, /background-color:#c85f28/);
  assert.match(NEWSLETTER_CTA_EMAIL_STYLE, /color:#ffffff/);
  assert.match(NEWSLETTER_CTA_EMAIL_STYLE, /text-decoration:none/);
  assert.equal(
    renderNewsletterCta("https://example.com/", "VIEW STORY"),
    `<p style="margin:24px 0 0"><a href="https://example.com/" style="${NEWSLETTER_CTA_EMAIL_STYLE}">VIEW STORY</a></p>`,
  );
});

test("dashboard immediately reflects a confirmed pause and resume", () => {
  const data = {
    nextEdition: null,
    editions: [],
    groups: [],
    series: [{
      id: "series-1",
      name: "Monthly",
      description: "",
      active: true,
      groupIds: [],
      individualRecipientIds: [],
      senderName: "",
      replyTo: "",
      brandInstructions: "",
      goals: "",
      defaultCta: "",
      timezone: "America/Denver",
      generationRule: "MANUAL",
      sendRule: "SECOND_THURSDAY_09:00",
    }],
  };
  const paused = updateSeriesActive(data, "series-1", false);
  assert.equal(paused.series[0].active, false);
  assert.equal(data.series[0].active, true);
  assert.equal(updateSeriesActive(paused, "series-1", true).series[0].active, true);
});

test("paused series jobs are never eligible for execution", () => {
  assert.equal(shouldExecuteNewsletterJob("ACTIVE"), true);
  assert.equal(shouldExecuteNewsletterJob("PAUSED"), false);
});

test("test subject receives one TEST prefix", () => {
  assert.equal(testEmailSubject("July newsletter"), "[TEST] July newsletter");
  assert.equal(testEmailSubject("[TEST] July newsletter"), "[TEST] July newsletter");
});
