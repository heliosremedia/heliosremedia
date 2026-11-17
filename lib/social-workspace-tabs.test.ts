import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Social tabs group campaigns and autopilot without hiding summary, actions, or creation draft", () => {
  const source = readFileSync("app/admin/social-studio/SocialDashboard.tsx", "utf8");
  const tabs = source.indexOf('<AdminWorkspaceTabs id="social-workspace"');
  assert.ok(source.indexOf('aria-label="Social workflow summary"') < tabs);
  assert.ok(source.indexOf('>New campaign</button>') < tabs);
  assert.ok(source.indexOf('id: "campaigns"') > tabs);
  assert.ok(source.indexOf('Recent campaigns') > tabs);
  assert.ok(source.indexOf('Coming week') > tabs);
  assert.match(source, /id: "autopilot", label: "Autopilot", hashAliases: \["autopilot-heading"\], content: autopilot/);
  assert.ok(source.indexOf('{open && <div role="dialog"') > source.indexOf(']} />', tabs));
  const page = readFileSync("app/admin/social-studio/page.tsx", "utf8");
  assert.match(page, /<SocialDashboard autopilot=\{<SocialAutopilot initialEnabled=\{autopilotSettings.enabled\}/);
  assert.equal((page.match(/<SocialAutopilot /g) || []).length, 1);
});
