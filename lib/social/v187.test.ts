import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("V1.8.7 enforces workspace-scoped project and media selection", () => {
  const createRoute = read("../../app/api/admin/social/campaigns/route.ts");
  const updateRoute = read("../../app/api/admin/social/campaigns/[campaignId]/route.ts");
  const campaignPage = read("../../app/admin/social-studio/campaigns/[campaignId]/page.tsx");
  assert.match(createRoute, /project\.findMany\(\{ where: \{ id: \{ in: projectIds \}, workspaceId \}/);
  assert.match(updateRoute, /project: \{ workspaceId \}/);
  assert.match(updateRoute, /selected assets are unavailable to this workspace/);
  assert.match(campaignPage, /project: \{ workspaceId \}/);
});

test("series and manual handoff remain planning-only", () => {
  const schema = read("../../prisma/schema.prisma");
  const series = read("../../lib/social/series.ts");
  const editor = read("../../app/admin/social-studio/campaigns/[campaignId]/SocialCampaignEditor.tsx");
  assert.match(schema, /@@unique\(\[seriesId, platform, scheduledAt\]\)/);
  assert.match(series, /skipDuplicates: true/);
  assert.match(editor, /Manual publishing checklist/);
  assert.match(editor, /Mark published/);
  assert.doesNotMatch(editor, />Publish now</);
});

test("AI output cannot approve or publish and generated imagery is disclosed", () => {
  const ai = read("../../app/api/admin/social/ai/route.ts");
  const image = read("../../app/api/admin/social/images/generate/route.ts");
  assert.match(ai, /Never approve, schedule, publish/);
  assert.match(ai, /Existing content was preserved/);
  assert.match(image, /not authentic Helios property photography/);
});
