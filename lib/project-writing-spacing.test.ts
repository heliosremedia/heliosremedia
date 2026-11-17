import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("writer separates counter, privacy disclosure and generation controls", () => {
  const source = readFileSync("app/admin/projects/ProjectWritingAssistant.tsx", "utf8");
  assert.match(source, /mt-3 block text-xs leading-5 text-white\/45.*source.length/);
  assert.match(source, /flex flex-col gap-4 pt-1">\s*<p[^>]*>Generate sends your description to OpenAI/);
  assert.ok(source.includes("Remove private contact details, access codes, and anything you do not want shared."));
  assert.ok(source.indexOf("Generate sends your description") < source.indexOf('disabled={busy || source.trim().length < 20}'));
});
