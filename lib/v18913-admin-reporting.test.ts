import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Referral Studio separates campaign information and responsive actions", () => {
  const source = read("app/admin/referral-studio/components/CampaignWorkspace.tsx");
  assert.match(source, /aria-label="Campaign actions"/);
  assert.match(source, /max-w-5xl/);
  assert.match(source, /sm:flex-row sm:flex-wrap sm:items-center/);
  assert.match(source, /sm:ml-auto/);
  assert.match(source, /admin-btn-primary w-full justify-center sm:w-auto/);
  assert.match(source, /admin-btn-destructive w-full justify-center sm:w-auto/);
  for (const handler of [
    'onClick={() => setTestOpen(true)}',
    'onClick={() => void openScheduleReview()}',
    'onClick={() => void returnToDraft(false)}',
    'onClick={() => void returnToDraft(true)}',
    'onClick={() => void archiveCampaign()}',
  ]) {
    assert.ok(source.includes(handler));
  }
});

test("Portfolio Intelligence refresh is range-preserving and read-only", () => {
  const controls = read(
    "app/admin/portfolio-intelligence/PortfolioIntelligenceControls.tsx",
  );
  const page = read("app/admin/portfolio-intelligence/page.tsx");
  assert.match(controls, /Refresh Data/);
  assert.match(controls, /if \(refreshing\) return/);
  assert.match(controls, /cache: "no-store"/);
  assert.match(controls, /\?range=\$\{range\}/);
  assert.match(controls, /router\.refresh\(\)/);
  assert.match(controls, /Existing reporting data remains visible/);
  assert.match(controls, /aria-busy=\{refreshing\}/);
  assert.match(controls, /aria-live="polite"/);
  assert.doesNotMatch(
    controls,
    /eventName|method:\s*"(?:POST|PUT|PATCH|DELETE)"/,
  );
  assert.match(page, /requireAdminSession\(\)/);
  assert.match(page, /workspaceId: session\.workspaceId/);
  assert.match(page, /text-xs leading-5/);
});
