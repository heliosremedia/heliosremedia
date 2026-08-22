import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Email Studio provides curated templates and safe formatting controls", () => {
  const studio = read("app/admin/email-studio/BulkEmailStudio.tsx");
  assert.match(studio, /Helios Signature|EMAIL_TEMPLATES/);
  assert.match(studio, /Clean Up Formatting/);
  assert.match(studio, /Format with AI/);
  assert.match(studio, /EmailTemplatePreview/);
  assert.match(studio, /Save Draft/);
  assert.match(studio, /Resume Draft/);
  assert.doesNotMatch(studio, /xl:sticky/);
});

test("campaign delivery persists and renders the chosen template", () => {
  const route = read("app/api/admin/email-campaigns/route.ts");
  const delivery = read("lib/client-communications/campaign-delivery.ts");
  const renderer = read("lib/client-communications/email.ts");
  assert.match(route, /templateKey/);
  assert.match(route, /input\.action === "draft"/);
  assert.match(delivery, /templateKey: campaign\.templateKey/);
  assert.match(renderer, /EDITORIAL_LIGHT/);
  assert.match(renderer, /renderFormattedEmailBody/);
});

test("Email AI uses strict schemas and keeps format-only behavior explicit", () => {
  const route = read("app/api/admin/email-ai/route.ts");
  assert.match(route, /type: "json_schema"/);
  assert.match(route, /Do not rewrite/);
  assert.match(route, /for \(let attempt = 0; attempt < 2/);
});
