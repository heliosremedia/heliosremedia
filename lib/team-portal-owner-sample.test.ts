import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { serveStudioTeamPortalSample } from "./team-portal-owner-sample.ts";

const root = "/admin/team-portal-sample";
const origin = "https://studio.example.test";
const owner = { role: "OWNER", email: "owner@example.test", workspaceId: "helios-test" };
const untrusted = () => { throw new Error("Not expected to read session."); };
const fixture = (parts: string[], session = owner, method = "GET", setting: string | undefined = owner.email) =>
  serveStudioTeamPortalSample(new Request(origin + root + "?email=owner%40example.test", { method }), parts, async () => session, setting);

test("uses the existing fresh Studio session and configured owner only, never forwards access", async () => {
  const source = readFileSync(new URL("../app/admin/team-portal-sample/[[...asset]]/route.ts", import.meta.url), "utf8");
  assert.match(source, /from "@\/lib\/auth\/session"/);
  assert.match(source, /serveStudioTeamPortalSample\(request, asset, getAdminSession, process\.env\.HELIOS_ADMIN_EMAIL\)/);
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /export \{ readSample as GET, readSample as HEAD \}/);
  assert.doesNotMatch(source, /\b(fetch|cookies|POST)\b/);
  for (const parts of [[], ["my-pay.html"], ["helios-nav.css"]]) {
    for (const session of [
      { ...owner, role: "ADMIN" }, { ...owner, role: "VIEWER" }, { ...owner, email: "other@example.test" },
      { ...owner, workspaceId: "" },
    ]) {
      const response = await fixture(parts, session);
      assert.equal(response.status, 403);
      assert.equal(await response.text(), "");
    }
    const noSetting = await serveStudioTeamPortalSample(new Request(origin + root), parts, async () => owner, undefined);
    assert.equal(noSetting.status, 403);
    assert.equal((await fixture(parts, owner, "GET", ' HELIOS_ADMIN_EMAIL="OWNER@example.test" ')).status, 200);
  }
});

test("permits only protected sample paths and retains the safe My Pay sign-in target", async () => {
  const request = new Request(origin + root + "?next=https://outside.example.test");
  for (const [parts, next] of [[[], root], [["my-pay.html"], root + "/my-pay.html"]] as const) {
    const response = await serveStudioTeamPortalSample(request, parts, async () => null, owner.email);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/login?next=" + encodeURIComponent(next));
    assert.equal(await response.text(), "");
  }
  assert.equal((await serveStudioTeamPortalSample(request, ["helios-nav.css"], async () => null, owner.email)).status, 401);
  const failed = await serveStudioTeamPortalSample(request, [], untrusted, owner.email);
  assert.equal(failed.status, 503);
  assert.equal(await failed.text(), "");
  for (const parts of [["../index.html"], ["exports"], ["foo", "my-pay.html"], ["__proto__"]]) {
    assert.equal((await serveStudioTeamPortalSample(request, parts, untrusted, owner.email)).status, 404);
  }
  for (const method of ["POST", "DELETE", "OPTIONS"]) {
    const denied = await serveStudioTeamPortalSample(new Request(origin + root, { method }), [], untrusted, owner.email);
    assert.equal(denied.status, 405);
    assert.equal(denied.headers.get("allow"), "GET, HEAD");
  }
});

test("protects HTML and stylesheet from caching, frames, forms and network calls", async () => {
  for (const [parts, type] of [[[], "text/html"], [["my-pay.html"], "text/html"], [["helios-nav.css"], "text/css"]] as const) {
    const result = await fixture([...parts]);
    assert.equal(result.status, 200);
    assert.ok(result.headers.get("Content-Type")?.startsWith(type));
    assert.equal(result.headers.get("Cache-Control"), "private, no-store");
    assert.equal(result.headers.get("Vary"), "Cookie");
    assert.equal(result.headers.get("X-Frame-Options"), "DENY");
    const policy = result.headers.get("Content-Security-Policy") ?? "";
    assert.match(policy, /connect-src 'none'/);
    assert.match(policy, /form-action 'none'/);
    assert.match(policy, /frame-ancestors 'none'/);
    const head = await fixture([...parts], owner, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  }
});

test("renders the same fictional rates and produces an in-browser sign-off only", async () => {
  const home = await (await fixture([])).text();
  assert.match(home, /href="\/admin\/team-portal-sample\/my-pay.html"/);
  assert.match(home, /src="\/brand\/helios-logo.png"/);
  assert.match(home, /href="\/admin">Back to Studio/);
  const pay = await (await fixture(["my-pay.html"])).text();
  assert.match(pay, /Basic \$140 · Pro \$165/);
  assert.match(pay, /sessionStorage\.setItem/);
  assert.match(pay, /helios-studio-team-pay-sample-v1/);
  assert.match(pay, /href="\/admin\/team-portal-sample#week"/);
  assert.doesNotMatch(pay, /\b(fetch|XMLHttpRequest|sendBeacon|localStorage)\b|\/api\/portal|austinbekkela|guerin@gmail|\$150\b|\$175\b/);
  const scripts = Array.from(pay.matchAll(/<script>([\s\S]*?)<\/script>/g), m => m[1]);
  const context = runInNewContext(scripts.slice(0, 2).join("\n") + "\n({week:weeklyPayFixtures[0],pay:weeklyPay});");
  const checked = Object.fromEntries(context.week.visits.map((row: { id: string }) => [row.id, { checked: true }]));
  const signed = context.pay.sign(context.week, checked);
  assert.equal(signed.total, 44500);
  assert.match(context.pay.email(signed), /\$445\.00/);
});
