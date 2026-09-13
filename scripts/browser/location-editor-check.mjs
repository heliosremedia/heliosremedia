import assert from "node:assert/strict";
import { chromium } from "playwright";

export async function checkLocationEditor(base) {
  assert.equal(new URL(base).hostname, "127.0.0.1", "Only an isolated loopback fixture is permitted");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], external = [], actualMutations = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== base) { external.push(request.url()); await route.abort(); return; }
    if (request.method() !== "GET") { actualMutations.push(request.method()); await route.abort(); return; }
    await route.continue();
  });
  const button = name => page.getByRole("button", { name, exact: true });
  const order = () => page.locator("main > div > article h2").allTextContents();
  const calls = () => page.evaluate(() => window.locationFixture.calls);
  const setup = async mode => {
    await page.goto(base); await button("Move One down").waitFor();
    await page.evaluate(mode => { window.locationFixture.mode = mode; }, mode);
  };
  const startReorder = async () => {
    await button("Move One down").evaluate(node => { node.click(); node.click(); });
    await page.waitForFunction(() => !!window.locationFixture.pending);
    assert.equal((await calls()).length, 1, "Rapid duplicate admission must be contained");
    const submitted = (await calls())[0];
    assert.equal(submitted.headers['x-helios-location-revision'], '1');
    assert.equal(JSON.parse(submitted.body).expectedUpdatedAt, '2026-09-13T00:00:00.000Z');
    assert.deepEqual(JSON.parse(submitted.body).expectedOrder, ['one', 'two'].map(id => ({ id, updatedAt: '2026-09-13T00:00:00.000Z' })));
    assert.deepEqual(await order(), ["One, State", "Two, State"], "No optimistic reorder while acknowledgement is pending");
    assert.equal(await button("Build a local page").isDisabled(), true);
    assert.equal(await button("Edit").first().isDisabled(), true);
  };
  try {
    await setup("success"); await startReorder();
    await page.evaluate(() => window.locationFixture.pending());
    await page.waitForFunction(() => document.querySelector("article h2")?.textContent === "Two, State");
    assert.equal(await button("Move One up").isEnabled(), true);

    for (const mode of ["lost-ack", "conflict", "non-json", "negative", "legacy-order", "foreign-order"]) {
      await setup(mode); await startReorder();
      await page.evaluate(() => window.locationFixture.pending());
      await button("Reload saved pages").waitFor();
      assert.match(await page.getByRole("alert").innerText(), /could not be confirmed/);
      assert.doesNotMatch(await page.getByRole("alert").innerText(), /PRIVATE/);
      assert.deepEqual(await order(), ["One, State", "Two, State"]);
      assert.equal(await button("Move One down").isDisabled(), true);
      assert.equal(await button("Build a local page").isDisabled(), true);
      for (const name of ["Edit", "Publish", "Delete"]) assert.equal(await button(name).first().isDisabled(), true);
      assert.equal((await calls()).length, 1, "No fallback mutation or automatic retry");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await button("Reload saved pages").focus();
      assert.equal(await button("Reload saved pages").evaluate(node => node === document.activeElement), true);
      await Promise.all([page.waitForEvent("load"), page.keyboard.press("Enter")]);
      await button("Move One down").waitFor();
      assert.equal(await button("Move One down").isEnabled(), true);
      assert.equal((await calls()).length, 0, "Explicit reload reads the fixture again without replaying the write");
    }

    for (const mode of ["save-conflict", "save-lost-ack", "save-legacy"]) {
      await setup(mode); await button("Edit").first().click();
      await page.getByRole("textbox", { name: /^Hero introduction/ }).fill("Keep my unsaved changes");
      await button("Save draft").evaluate(node => { node.click(); node.click(); });
      await page.waitForFunction(() => !!window.locationFixture.pending);
      assert.equal((await calls()).length, 1);
      assert.equal(JSON.parse((await calls())[0].body).expectedUpdatedAt, "2026-09-13T00:00:00.000Z");
      assert.equal(await page.getByRole("textbox", { name: /^Hero introduction/ }).isDisabled(), true, "Typing cannot race an acknowledged save");
      assert.equal(await button("Close editor").isDisabled(), true);
      await page.evaluate(() => window.locationFixture.pending());
      await page.getByRole("dialog").getByText(/Your draft is still here/).waitFor();
      assert.equal(await page.getByRole("textbox", { name: /^Hero introduction/ }).inputValue(), "Keep my unsaved changes");
      assert.equal(await button("Save draft").isDisabled(), true);
      assert.equal(await button("Reload saved pages").count(), 0, "No reload action while an unsaved draft is open");
      assert.equal((await calls()).length, 1);
      await button("Cancel").click(); await button("Reload saved pages").waitFor();
    }

    // A reorder refreshes row revisions; later saves submit the returned revision.
    await setup("success"); await startReorder();
    await page.evaluate(() => window.locationFixture.pending());
    await page.waitForFunction(() => document.querySelector("article h2")?.textContent === "Two, State");
    await button("Edit").nth(1).click();
    await page.getByRole("textbox", { name: /^Hero introduction/ }).fill("Saved after reorder");
    await button("Save draft").click(); await page.waitForFunction(() => !!window.locationFixture.pending);
    assert.equal(JSON.parse((await calls())[1].body).expectedUpdatedAt, "2026-09-13T01:00:00.000Z");
    await page.evaluate(() => window.locationFixture.pending());
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await button("Edit").nth(1).click();
    assert.equal(await page.getByRole("textbox", { name: /^Hero introduction/ }).inputValue(), "Saved after reorder");
    await button("Cancel").click();

    await setup("success"); await button("Edit").first().click();
    const file = { name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("synthetic fixture bytes") };
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.waitForFunction(() => !!window.locationFixture.upload);
    assert.equal(await button("Save draft").isDisabled(), true);
    await page.getByRole("textbox", { name: /^Hero introduction/ }).fill("Keep text entered during the upload");
    await page.evaluate(() => window.locationFixture.upload());
    await page.getByRole("textbox", { name: /^Feature image alt text/ }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: /^Hero introduction/ }).inputValue(), "Keep text entered during the upload");
    assert.equal(await button("Save draft").isEnabled(), true);
    assert.equal((await calls()).filter(call => call.method === "PUT").length, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    await page.locator('input[type="file"]').setInputFiles(file);
    await page.waitForFunction(() => !!window.locationFixture.upload);
    await button("Close editor").click();
    await button("Edit").nth(1).click();
    await page.getByRole("textbox", { name: /^Hero introduction/ }).fill("Other page draft");
    await page.evaluate(() => window.locationFixture.upload());
    await page.waitForFunction(() => document.querySelector('input[type="file"]')?.disabled === false);
    assert.equal(await page.getByRole("dialog").getByRole("heading", { name: "Two", exact: true }).count(), 1);
    assert.equal(await page.getByRole("textbox", { name: /^Hero introduction/ }).inputValue(), "Other page draft");
    assert.equal(await page.getByRole("textbox", { name: /^Feature image alt text/ }).count(), 0, "Late upload must not attach to another editor");
    assert.equal((await calls()).filter(call => call.url === "/api/admin/locations").length, 0, "Uploading does not save or publish content");

    await setup("success"); await button("Edit").first().click(); await button("Open assistant").click();
    await button("Auto generate").evaluate(node => { node.click(); node.click(); });
    await page.waitForFunction(() => !!window.locationFixture.ai);
    assert.equal((await calls()).length, 1);
    await button("Close editor").click(); await button("Edit").nth(1).click(); await button("Open assistant").click();
    await page.evaluate(() => window.locationFixture.ai());
    await button("Auto generate").waitFor();
    assert.equal(await button("Apply complete draft").count(), 0, "Late AI draft cannot enter another editor");
    assert.equal(await page.getByRole("textbox", { name: /^Hero introduction/ }).inputValue(), "Original lead");
    await button("Auto generate").click(); await page.waitForFunction(() => !!window.locationFixture.ai);
    await page.evaluate(() => window.locationFixture.ai()); await button("Apply complete draft").waitFor();
    assert.equal(await page.getByRole("textbox", { name: /^Hero introduction/ }).inputValue(), "Original lead", "AI output requires explicit application");
    await button("Apply complete draft").click();
    assert.equal(await page.getByRole("textbox", { name: /^Hero introduction/ }).inputValue(), "Synthetic draft for the original page");
    assert.equal((await calls()).filter(call => call.url === "/api/admin/locations").length, 0, "AI draft application does not save or publish");
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(actualMutations, []);
    console.log("PASS: actual Chromium location component revision submissions, authoritative order, duplicate requests, six uncertain reorder responses, three held-save responses, save/reopen, mobile, upload and AI recovery; synthetic fetch only");
  } finally { await browser.close(); }
}
