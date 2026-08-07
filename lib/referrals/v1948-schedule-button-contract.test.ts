import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync(
  "app/admin/referral-studio/components/CampaignWorkspace.tsx",
  "utf8",
);

test("schedule confirmation has an explicit button action", () => {
  const buttonStart = workspace.lastIndexOf(
    '<button\n                type="button"',
    workspace.indexOf('"Schedule Campaign"'),
  );
  const button = workspace.slice(
    buttonStart,
    workspace.indexOf("</button>", buttonStart),
  );

  assert.match(button, /type="button"/);
  assert.match(button, /onClick=\{\(\) => void scheduleCampaign\(\)\}/);
  assert.doesNotMatch(button, /saveWithoutScheduling/);
});

test("schedule errors are visible inside the scheduling dialog", () => {
  const dialogStart = workspace.indexOf('aria-labelledby="schedule-title"');
  const dialog = workspace.slice(
    dialogStart,
    workspace.indexOf("</form>", dialogStart),
  );

  assert.match(dialog, /role="alert"/);
  assert.match(dialog, /aria-live="assertive"/);
  assert.match(dialog, /\{message\}/);
});
