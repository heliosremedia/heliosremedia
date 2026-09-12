// Run against the bundled synthetic fixture, never a real Studio environment.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const base = process.env.RECOVERY_FIXTURE_URL || "http://127.0.0.1:4177";
assert.equal(new URL(base).hostname, "127.0.0.1", "Synthetic checks only run on loopback");
const button = name => page.getByRole("button", { name, exact: true });
const posts = () => page.evaluate(() => window.recoveryFixture.calls.filter(call => call.method === "POST"));
async function setup(mode = "eligible") {
  await page.goto(base);
  await page.waitForSelector("textarea");
  await page.evaluate(mode => { window.recoveryFixture.mode = mode; }, mode);
  assert.equal(await posts().then(x => x.length), 0);
  await button("Load generation review").click();
}
async function confirm() {
  await button("Return generation to review").click();
  assert.equal(await button("Confirm recovery").isDisabled(), true);
  assert.equal(await posts().then(x => x.length), 0);
  await page.getByRole("checkbox").check();
  // Two synchronous clicks exercise the ref guard before React's next render.
  await button("Confirm recovery").evaluate(node => { node.click(); node.click(); });
}
try {
  await setup();
  await button("Return generation to review").click();
  await page.getByRole("checkbox").waitFor();
  assert.equal(await page.getByRole("checkbox").evaluate(node => node === document.activeElement), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(await button("Cancel").evaluate(node => node === document.activeElement), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await button("Return generation to review").evaluate(node => node === document.activeElement), true);
  await page.getByRole("textbox").fill("Unsaved changes must survive");
  await confirm();
  await page.getByText("Recorded edition state: needs review.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox").inputValue(), "Unsaved changes must survive");
  const calls = await posts();
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].body), { confirmation: "RETURN_EXPIRED_GENERATION_TO_REVIEW", expectedVersion: 6, runId: "synthetic-run" });
  assert.equal(await button("Return generation to review").count(), 0);

  await setup("stale"); await confirm();
  await page.getByRole("status").filter({ hasText: "Load a fresh review" }).waitFor();
  assert.equal(await button("Return generation to review").count(), 0);
  assert.equal((await posts()).length, 1);
  await setup("forbidden");
  await page.getByRole("status").filter({ hasText: "Administrator access" }).waitFor();
  assert.equal((await posts()).length, 0);
  await setup("blocked");
  await page.getByText(/Recovery is unavailable/).waitFor();
  assert.equal(await button("Return generation to review").count(), 0);
  assert.equal((await posts()).length, 0);
  await setup("refresh-fails"); await confirm();
  await page.getByRole("status").filter({ hasText: "Generation returned to review, but" }).waitFor();
  assert.equal(await button("Return generation to review").count(), 0);
  assert.equal((await posts()).length, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await setup(); await button("Return generation to review").click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: process.env.RECOVERY_SCREENSHOT || "/tmp/helios-recovery-browser/mobile-confirmation.png", fullPage: true });
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.jobHealthFixture.calls.length), 0);
  await button("Refresh job status").evaluate(node => { node.click(); node.click(); });
  await page.getByText("Synthetic interrupted edition", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.jobHealthFixture.calls.length), 1);
  assert.equal(await page.getByRole("link", { name: "Open edition review for Synthetic interrupted edition" }).getAttribute("href"), "/admin/newsletter-studio/editions/edition%2Fa#generation-recovery-title");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => { window.jobHealthFixture.mode = "unavailable"; });
  await button("Refresh job status").click();
  await page.getByRole("status").filter({ hasText: "Job status is unavailable" }).waitFor();
  assert.equal(await page.getByText("Synthetic interrupted edition", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.jobHealthFixture.calls.every(call => call.method === "GET")), true);
  const analytics = page.getByRole('region', { name: 'Analytics job review', exact: true });
  const analyticsPosts = () => page.evaluate(() => window.analyticsRecoveryFixture.calls.filter(call => call.method === 'POST'));
  async function loadAnalytics(mode = 'eligible') {
    await page.goto(base);
    await analytics.waitFor();
    assert.equal(await page.evaluate(() => window.analyticsRecoveryFixture.calls.length), 0);
    await page.evaluate(mode => { window.analyticsRecoveryFixture.mode = mode; }, mode);
    await button('Load analytics jobs').evaluate(node => { node.click(); node.click(); });
    await analytics.getByRole('button', { name: 'Review analytics job analytics/job-a', exact: true }).click();
    assert.equal((await analyticsPosts()).length, 0);
  }
  async function cancelAnalytics() {
    assert.equal(await button('Confirm analytics cancellation').isDisabled(), true);
    await analytics.getByRole('checkbox').check();
    await button('Confirm analytics cancellation').evaluate(node => { node.click(); node.click(); });
  }
  await loadAnalytics();
  await analytics.getByRole('heading', { name: 'Review analytics/job-a: RUNNING', exact: true }).waitFor();
  assert.equal(await analytics.getByRole('heading', { name: 'Review analytics/job-a: RUNNING', exact: true }).evaluate(node => node === document.activeElement), true);
  assert.equal(await page.evaluate(() => window.analyticsRecoveryFixture.calls.filter(call => call.url === '/api/admin/social/analytics/jobs').length), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await cancelAnalytics();
  await analytics.getByRole('status').filter({ hasText: 'Analytics cancellation recorded.' }).waitFor();
  assert.equal((await analyticsPosts()).length, 1);
  assert.deepEqual(JSON.parse((await analyticsPosts())[0].body), { action: 'cancel', confirmed: true, reviewVersion: 'a'.repeat(64) });
  assert.equal((await analyticsPosts())[0].url, '/api/admin/social/analytics/jobs/analytics%2Fjob-a/recovery');
  assert.equal(await button('Confirm analytics cancellation').count(), 0);
  for (const mode of ['stale', 'ack-lost']) {
    await loadAnalytics(mode); await cancelAnalytics();
    await analytics.getByRole('status').filter({ hasText: 'Cancellation could not be confirmed.' }).waitFor();
    assert.equal((await analyticsPosts()).length, 1);
    assert.equal(await button('Confirm analytics cancellation').count(), 0);
    if (mode === 'ack-lost') {
      await analytics.getByRole('button', { name: 'Review analytics job analytics/job-a', exact: true }).click();
      await analytics.getByRole('heading', { name: 'Review analytics/job-a: CANCELLED', exact: true }).waitFor();
      assert.equal((await analyticsPosts()).length, 1);
    }
  }
  for (const [mode, text] of [['disabled', 'Cancellation is disabled'], ['blocked', 'This job is not eligible'], ['malformed', 'Analytics job state is unavailable']]) {
    await loadAnalytics(mode); await analytics.getByText(text, { exact: false }).waitFor();
    assert.equal(await button('Confirm analytics cancellation').count(), 0); assert.equal((await analyticsPosts()).length, 0);
  }
  await loadAnalytics();
  await page.evaluate(() => { window.analyticsRecoveryFixture.mode = 'forbidden'; });
  await button('Load analytics jobs').click();
  await analytics.getByRole('status').filter({ hasText: 'Administrator access is required.' }).waitFor();
  assert.equal(await analytics.getByRole('checkbox').count(), 0);
  assert.equal(await analytics.getByRole('button', { name: 'Review analytics job analytics/job-a', exact: true }).count(), 0);
  assert.equal((await analyticsPosts()).length, 0);
  assert.deepEqual(errors, []);
  console.log("PASS: confirmation, keyboard focus, duplicate prevention, unsaved notes, stale/access/blocked states, failed refresh, mobile overflow, runtime errors, read-only job health and review links");
  console.log('PASS: analytics discovery, encoded review links, fresh confirmation, duplicate prevention, disabled/access/changed claims, committed-response loss, no automatic retry, mobile layout and runtime errors');
} finally { await browser.close(); }
