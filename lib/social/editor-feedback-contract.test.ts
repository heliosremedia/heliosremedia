import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor = readFileSync(new URL("../../app/admin/social-studio/campaigns/[campaignId]/SocialCampaignEditor.tsx", import.meta.url), "utf8");

test("Social Studio preserves successful action feedback across reloads", () => {
  assert.match(editor, /sessionStorage\.setItem\("social-action-confirmation", confirmation\)/);
  assert.match(editor, /sessionStorage\.getItem\("social-action-confirmation"\)/);
  assert.match(editor, /async function action[\s\S]*sessionStorage\.removeItem\("social-action-confirmation"\)/);
  assert.match(editor, /Variant submitted for review\./);
  assert.match(editor, /Variant approved\./);
});
