import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Brand Identity toggle is anchored to the complete card header", () => {
  const form = read("app/admin/settings/SiteSettingsForm.tsx");
  assert.match(form, /flex items-start justify-between gap-4[\s\S]*?max-w-3xl[\s\S]*?AdminCardToggle className="shrink-0" expanded=\{expandedSections\["brand-identity"\]\}/);
  assert.match(form, /label="Brand Identity" controls="brand-identity-content"/);
});

test("Connected profiles use saved valid destinations and safe accessible links", () => {
  const form = read("app/admin/settings/SiteSettingsForm.tsx");
  assert.match(form, /const connectedProfileDefinitions/);
  assert.match(form, /validExternalDestination\(savedSettings\[definition\.key\]\)/);
  assert.match(form, /Connected profiles/);
  assert.match(form, /target="_blank"/);
  assert.match(form, /rel="noopener noreferrer"/);
  assert.match(form, /aria-label=\{`Open \$\{savedSettings\.businessName\} \$\{profile\.label\}`\}/);
  assert.match(form, /focus-visible:outline-\[var\(--helios-orange\)\]/);
});

test("explicit saved URLs are validated without presentation rewriting", () => {
  const route = read("app/api/admin/site-settings/route.ts");
  assert.match(route, /return explicitlyQualified \? result : parsed\.toString\(\)/);
});
