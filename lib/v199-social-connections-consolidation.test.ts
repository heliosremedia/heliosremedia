import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Social Studio uses one Meta connection surface", () => {
  const settings = read("app/admin/social-studio/settings/SocialSettings.tsx");

  assert.equal((settings.match(/<MetaConnectionPicker/g) ?? []).length, 1);
  assert.doesNotMatch(settings, />Social connections</);
  assert.match(settings, /Provider Infrastructure/);
  assert.match(settings, /aria-expanded=\{infrastructureOpen\}/);
  assert.match(settings, /infrastructureOpen\?"Hide diagnostics":"Show diagnostics"/);
});

test("Meta connection cards preserve guide and fallback controls", () => {
  const picker = read("app/admin/social-studio/settings/MetaConnectionPicker.tsx");

  assert.match(picker, /Official Meta connection/);
  assert.match(picker, /Connection guide/);
  assert.match(picker, /Manual fallback settings/);
  assert.match(picker, /Manual publishing link/);
  assert.match(picker, /Save fallback/);
});
