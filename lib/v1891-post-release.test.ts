import assert from "node:assert/strict";
import test from "node:test";
import { inspectBlogStructure } from "./blog-structure.ts";
import { buildNewsletterImageDirection } from "./newsletters/image-direction.ts";
import { readFileSync } from "node:fs";

test("blog structure checks flag actionable Markdown problems", () => {
  const issues = inspectBlogStructure("Agent Branding", "# Agent Branding\n\n1.No space\n\nA long article body ".repeat(70));
  assert.ok(issues.includes("duplicate-title"));
  assert.ok(issues.includes("malformed-list"));
  assert.ok(issues.includes("missing-sections"));
});

test("newsletter image direction is deterministic and does not invent property details", () => {
  const direction = buildNewsletterImageDirection({ label: "Market note", heading: "A stronger first impression", body: "Thoughtful imagery helps listings communicate quality." });
  assert.match(direction, /Subject:/);
  assert.match(direction, /Mood and lighting:/);
  assert.match(direction, /do not invent a specific property or location/i);
  assert.equal(buildNewsletterImageDirection({}), "");
});

test("post-release interfaces preserve explicit safety and confirmation language", () => {
  const referral = readFileSync(new URL("../app/admin/referral-studio/components/CampaignWorkspace.tsx", import.meta.url), "utf8");
  const blog = readFileSync(new URL("../app/admin/blog/BlogStudio.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../app/admin/settings/SiteSettingsForm.tsx", import.meta.url), "utf8");
  assert.match(referral, /Automatic recovery is disabled/);
  assert.match(referral, /Return to Approved/);
  assert.match(blog, /Improve Structure/);
  assert.match(blog, /Apply Structure/);
  assert.match(settings, /Business Identity/);
  assert.match(settings, /Booking Experience/);
  assert.match(settings, /Legal &amp; Privacy/);
});
