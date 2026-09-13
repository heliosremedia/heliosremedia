import assert from 'node:assert/strict';
import { chromium } from 'playwright';

export async function checkLegalEditor(base) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== base || route.request().method() !== 'GET') {
      unexpected.push(route.request().url()); await route.abort(); return;
    }
    await route.continue();
  });
  const article = index => page.locator('article').nth(index);
  const save = index => article(index).getByRole('button', { name: 'Save document', exact: true });
  const setup = async mode => { await page.goto(base); await save(0).waitFor(); await page.evaluate(mode => { window.legalFixture.mode = mode; }, mode); };
  const start = async (index = 0) => {
    await save(index).evaluate(node => { node.click(); node.click(); });
    await page.waitForFunction(() => !!window.legalFixture.pending);
    assert.equal(await page.evaluate(() => window.legalFixture.calls.length), 1);
    assert.equal(await article(0).getByLabel('Page title').isDisabled(), true);
    assert.equal(await article(1).getByLabel('Publish in footer').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.legalFixture.calls[0].headers['x-helios-legal-revision']), '1');
  };
  const finish = () => page.evaluate(() => window.legalFixture.pending());
  try {
    await setup('success');
    await article(0).getByLabel('Page title').fill('  Reviewed title  ');
    await article(0).getByLabel('Document body · HTML').fill('<p>' + 'Synthetic reviewed copy. '.repeat(10) + '</p>');
    await article(0).getByLabel('Publish in footer').check();
    assert.match(await article(0).innerText(), /Saved: draft/);
    await article(1).getByLabel('Page title').fill('Retain other draft');
    await start(); await finish(); await save(0).waitFor();
    assert.equal(await article(0).getByLabel('Page title').inputValue(), 'Reviewed title');
    assert.equal(await article(0).getByLabel('Document body · HTML').inputValue(), '<p>' + 'Sanitized synthetic copy. '.repeat(10) + '</p>');
    assert.equal(await article(1).getByLabel('Page title').inputValue(), 'Retain other draft');
    assert.match(await page.getByRole('status').innerText(), /Reviewed title saved and published/);
    assert.match(await article(0).innerText(), /Saved: published/);
    await setup('success'); await start(1); await finish(); await save(1).waitFor();
    assert.equal(await save(1).isEnabled(), true, 'new owned identity accepted');

    for (const mode of ['lost-ack', 'conflict', 'forbidden', 'non-json', 'foreign', 'stale', 'wrong-publication', 'legacy']) {
      await setup(mode);
      await article(0).getByLabel('Page title').fill('Preserve unsaved privacy');
      await article(1).getByLabel('Page title').fill('Preserve unsaved terms');
      await start(); await finish(); await page.getByRole('alert').waitFor();
      assert.doesNotMatch(await page.getByRole('alert').innerText(), /PRIVATE/);
      assert.equal(await save(0).isDisabled(), true); assert.equal(await save(1).isDisabled(), true);
      const snapshot = page.getByLabel('Unsaved legal documents', { exact: true });
      assert.match(await snapshot.inputValue(), /Preserve unsaved privacy/); assert.match(await snapshot.inputValue(), /Preserve unsaved terms/);
      await snapshot.focus(); assert.equal(await snapshot.evaluate(node => node.selectionEnd === node.value.length), true);
      const reload = page.getByRole('button', { name: 'Reload saved documents' });
      assert.equal(await reload.isDisabled(), true);
      await page.getByLabel('I have preserved my unsaved copy').check(); await reload.focus();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await Promise.all([page.waitForEvent('load'), page.keyboard.press('Enter')]);
      await save(0).waitFor(); assert.equal(await page.evaluate(() => window.legalFixture.calls.length), 0, 'reload never replays publication');
    }
    await setup('success'); await page.clock.install(); await start();
    await page.clock.fastForward(30001); await page.getByRole('alert').waitFor();
    await finish(); await page.clock.runFor(10);
    assert.equal(await save(0).isDisabled(), true, 'late success after timeout cannot release the hold');
    assert.equal(await page.evaluate(() => window.legalFixture.calls.length), 1);
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    console.log('PASS: real legal editor Chromium: duplicate/frozen saves, confirmed publication, creation, eight held responses, copied draft recovery, timeout/late response, mobile/desktop; synthetic fetch only');
  } finally { await browser.close(); }
}
