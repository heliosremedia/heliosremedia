import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage curation uses full-width ordered workspaces and truthful save state", () => {
  const source = read("app/admin/settings/SiteSettingsForm.tsx");
  const media = source.indexOf("Homepage media");
  const availability = source.indexOf("Availability message", media);
  const copy = source.indexOf("Homepage copy", availability);
  assert.ok(media >= 0 && availability > media && copy > availability);
  assert.match(source, /Save Homepage Settings/);
  assert.match(source, /Unsaved changes\./);
  assert.match(source, /beforeunload/);
  assert.match(source, /disabled=\{saving \|\| uploading !== null \|\| !dirty\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /controls muted playsInline/);
  assert.match(source, /event\.key === "Escape"/);
});

test("analytics persistence states and health output are accurate and sanitized", () => {
  const route = read("app/api/portfolio-analytics/route.ts");
  const client = read("app/components/PortfolioAnalytics.tsx");
  const health = read("app/api/health/public/route.ts");
  assert.match(route, /state: "stored"/);
  assert.match(route, /state: "failed"/);
  assert.match(route, /status: category === "migration_or_schema_failure" \? 503 : 500/);
  assert.doesNotMatch(route, /storage_unavailable" \},\s*\{ status: 202/);
  assert.match(client, /result\?\.state === "stored"/);
  assert.match(client, /attempt < 2/);
  assert.match(health, /awaiting_first_event/);
  assert.match(health, /Cache-Control": "no-store"/);
  assert.doesNotMatch(health, /DATABASE_URL|stack|sessionId|connectionString|rawError/);
});

test("V1.8.9.4 preserves the deployed V1.8.9 analytics release record", () => {
  const releases = read("lib/releases.ts");
  const version = read("lib/version.ts");
  assert.match(releases, /version: "V1\.8\.9"/);
  assert.match(releases, /status: "LIVE"/);
  assert.match(version, /V1\.8\.9\.4/);
});
