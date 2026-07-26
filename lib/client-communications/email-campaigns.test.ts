import assert from "node:assert/strict";
import test from "node:test";
import {
  findUnsupportedVariables,
  renderPersonalizedEmail,
  renderPersonalizedText,
} from "./personalization.ts";
import { validTimeZone, zonedLocalToUtc } from "./scheduling.ts";

const recipient = {
  firstName: "Jake",
  lastName: "Guerin",
  fullName: "Jake Guerin",
  email: "jake@example.com",
  phone: "970.682.5533",
};

test("renders all supported personalization variables in every email field", () => {
  const rendered = renderPersonalizedEmail({
    subject: "For {{FIRST_NAME}} {{LAST_NAME}}",
    previewText: "{{FULL_NAME}} · {{EMAIL}}",
    body: "Call {{PHONE}}, {{FIRST_NAME}}.",
    recipient,
  });
  assert.equal(rendered.subject, "For Jake Guerin");
  assert.equal(rendered.previewText, "Jake Guerin · jake@example.com");
  assert.equal(rendered.body, "Call 970.682.5533, Jake.");
});

test("replaces repeated variables without cross-recipient leakage", () => {
  const template = "{{FIRST_NAME}} / {{FIRST_NAME}} / {{EMAIL}}";
  assert.equal(renderPersonalizedText(template, recipient), "Jake / Jake / jake@example.com");
  assert.equal(renderPersonalizedText(template, { ...recipient, firstName: "Alex", email: "alex@example.com" }), "Alex / Alex / alex@example.com");
});

test("uses safe missing-value fallbacks and removes obvious punctuation spacing", () => {
  assert.equal(renderPersonalizedText("Hello {{FIRST_NAME}}, phone {{PHONE}}.", {
    email: "client@example.com",
  }), "Hello there, phone.");
});

test("rejects unknown and incorrectly cased variables", () => {
  assert.deepEqual(findUnsupportedVariables("{{COMPANY_NAME}}", "{{first_name}}"), ["COMPANY_NAME", "first_name"]);
  assert.deepEqual(findUnsupportedVariables("{{FIRST_NAME}}", "{{PHONE}}"), []);
});

test("converts Mountain Time to UTC and preserves daylight-saving behavior", () => {
  assert.equal(zonedLocalToUtc("2026-01-15T09:00", "America/Denver").toISOString(), "2026-01-15T16:00:00.000Z");
  assert.equal(zonedLocalToUtc("2026-07-29T09:00", "America/Denver").toISOString(), "2026-07-29T15:00:00.000Z");
});

test("rejects invalid timezone and nonexistent DST local time", () => {
  assert.equal(validTimeZone("America/Denver"), true);
  assert.equal(validTimeZone("Mountain/Imaginary"), false);
  assert.throws(() => zonedLocalToUtc("2026-03-08T02:30", "America/Denver"), /does not exist/);
});
