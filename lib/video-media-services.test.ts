import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defaultVideoServiceId, videoMediaServices } from "./video-media-services.ts";
const service = (slug: string, active = true, archivedAt: string | null = null) => ({
  id: slug + "-id", slug, name: "Legacy display name", active, archivedAt, description: null, displayOrder: 0,
});
test("both video pickers use five explicit ordered service collections", () => {
  const rows = videoMediaServices([service("photography"), service("social-content"), service("cinematic-films"), service("agent-branding"), service("ai-cinematic-films"), service("vertical-reels")]);
  assert.deepEqual(rows.map((row) => row.label), ["Cinematic Films", "Agent Branding", "AI Cinematic Films", "Vertical Reels", "Social Content"]);
  assert.equal(defaultVideoServiceId([service("photography"), service("cinematic-films")]), "cinematic-films-id");
  assert.equal(rows[2].service?.id, "ai-cinematic-films-id");
});
test("missing, inactive and archived video services cannot silently fall back to photography", () => {
  const services = [service("photography"), service("cinematic-films", false), service("agent-branding", true, "2026-01-01")];
  assert.equal(defaultVideoServiceId(services), "");
  assert.equal(videoMediaServices(services).length, 5);
  assert.ok(videoMediaServices(services).every((row) => row.service === null));
});
test("both forms share default/filter, guard submission, and retain both upload methods", () => {
  for (const file of ["ExternalMediaForm.tsx", "StreamVideoUploader.tsx"]) {
    const source = readFileSync(new URL("../app/admin/projects/[projectId]/" + file, import.meta.url), "utf8");
    assert.match(source, /defaultVideoServiceId\(services\)/);
    assert.match(source, /videoMediaServices\(services\)/);
    assert.match(source, /if \(!selectedService\)/);
    assert.match(source, /disabled=\{!collection.service\}/);
  }
  const hosted = readFileSync(new URL("../app/admin/projects/[projectId]/ExternalMediaForm.tsx", import.meta.url), "utf8");
  assert.match(hosted, /value="YOUTUBE"/);
  assert.match(hosted, /value="VIMEO"/);
  const stream = readFileSync(new URL("../app/admin/projects/[projectId]/StreamVideoUploader.tsx", import.meta.url), "utf8");
  assert.match(stream, /Upload to Stream/);
});
