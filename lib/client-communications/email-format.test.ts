import assert from "node:assert/strict";
import test from "node:test";

import { cleanPastedEmailText, normalizeEmailTemplateKey, renderFormattedEmailBody } from "./email-format.ts";

test("copied Markdown is normalized without losing personalization tokens", () => {
  assert.equal(cleanPastedEmailText("```markdown\r\nHi {{FIRST_NAME}},\r\n\r\n• **Thank you**\r\n```"), "Hi {{FIRST_NAME}},\n\n- **Thank you**");
});

test("safe email formatting renders headings, emphasis, lists, and escapes raw HTML", () => {
  const html = renderFormattedEmailBody("### A better heading\n\nUse **LOYAL50**.\n\n- One\n- Two\n\n<script>alert(1)</script>");
  assert.match(html, /<h2/);
  assert.match(html, /<strong>LOYAL50<\/strong>/);
  assert.match(html, /<ul/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("unknown templates fall back to the Helios signature", () => {
  assert.equal(normalizeEmailTemplateKey("UNKNOWN"), "SIGNATURE");
  assert.equal(normalizeEmailTemplateKey("EDITORIAL_LIGHT"), "EDITORIAL_LIGHT");
});

