import assert from 'node:assert/strict';
import { chromium } from 'playwright';
export async function checkFilmEditor(base) {
 assert.equal(new URL(base).hostname, '127.0.0.1');
 const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
 try {
  for (const width of [390, 1440]) {
   const page = await browser.newPage({ viewport: { width, height: 1000 } }); const errors = [], unexpected = [];
   page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('dialog', d => d.accept());
   await page.route('**/*', async route => { if (new URL(route.request().url()).origin !== base || route.request().method() !== 'GET') { unexpected.push(route.request().url()); await route.abort(); } else await route.continue(); });
   await page.clock.install();
   const save = () => page.getByRole('button', { name: 'Save feature', exact: true });
   const input = () => page.getByLabel('Card destination'); const copy = () => page.getByLabel('Unsaved featured film copy');
   const setup = async (mode = 'success', suffix = '') => { await page.goto(base + '/' + suffix); await save().waitFor(); await page.evaluate(m => { window.filmFixture.mode = m; }, mode); };
   const start = async () => { await save().evaluate(n => { n.click(); n.click(); }); await page.waitForFunction(() => !!window.filmFixture.pending); assert.equal(await input().isDisabled(), true); assert.equal(await page.evaluate(() => window.filmFixture.calls.length), 1); };
   const finish = () => page.evaluate(() => window.filmFixture.pending());
   const settled = () => page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
   const upload = async kind => { await page.locator('input[type="file"]').nth(kind === 'video' ? 0 : 1).setInputFiles({ name: kind === 'video' ? 'test.mp4' : 'test.webp', mimeType: kind === 'video' ? 'video/mp4' : 'image/webp', buffer: Buffer.from('synthetic') }); await page.waitForFunction(() => !!window.filmFixture.presignPending); };
   try {
    await setup(); await input().fill('/retained'); await start(); assert.equal(await page.evaluate(() => window.filmFixture.calls[0].headers['x-helios-film-revision']), '1');
    await finish(); await settled(); assert.match(await page.getByRole('status').innerText(), /saved and confirmed/); assert.equal(await input().inputValue(), '/retained');
    await input().fill('/next'); await save().click(); await page.waitForFunction(() => !!window.filmFixture.pending); assert.equal(await page.evaluate(() => window.filmFixture.calls[1].editorRevision.updatedAt), '2026-09-17T00:00:01.000Z'); await finish(); await settled();
    for (const mode of ['lost-ack', 'non-json', 'conflict', 'foreign-id', 'foreign-workspace', 'foreign-owner', 'stale', 'invalid-revision', 'wrong-prior', 'wrong-request', 'wrong-scope', 'wrong-intent', 'wrong-media', 'wrong-url', 'unregistered', 'foreign-proof', 'legacy']) {
     await setup(mode); await input().fill('/keep-this'); await start(); await finish(); await page.getByRole('alert').waitFor(); assert.match(await copy().inputValue(), /keep-this/); assert.doesNotMatch(await page.getByRole('alert').innerText(), /PRIVATE/); assert.equal(await save().isDisabled(), true);
     await copy().focus(); assert.equal(await copy().evaluate(n => n.selectionEnd === n.value.length), true);
     const reload = page.getByRole('button', { name: 'Reload saved film' }); assert.equal(await reload.isDisabled(), true); await page.getByLabel('I have preserved my film copy').check();
     assert.equal(await page.evaluate(() => window.filmFixture.calls.length), 1); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
     await reload.focus(); await Promise.all([page.waitForEvent('load'), page.keyboard.press('Enter')]); await save().waitFor(); assert.equal(await page.evaluate(() => window.filmFixture.calls.length), 0);
    }
    await setup(); await start(); await page.clock.fastForward(30001); await page.getByRole('alert').waitFor(); await finish(); await page.clock.runFor(10); assert.equal(await save().isDisabled(), true);
    await setup('slow-json'); await start(); await finish(); await page.waitForFunction(() => !!window.filmFixture.jsonPending); await page.clock.fastForward(30001); await page.getByRole('alert').waitFor();
    await page.evaluate(() => window.filmFixture.remount()); await page.waitForFunction(() => !document.querySelector('[role="alert"]')); await input().fill('/new-instance'); await page.evaluate(() => window.filmFixture.jsonPending()); await page.clock.runFor(10); assert.equal(await input().inputValue(), '/new-instance');
    for (const kind of ['video', 'poster']) {
     for (const mode of ['success', 'lost-ack', 'unregistered', 'wrong-url', 'foreign-proof']) {
      await setup(mode); await input().fill('/upload-draft'); await upload(kind); assert.equal(await input().isDisabled(), true); assert.equal(await page.locator('input[type="file"]').first().isDisabled(), true);
      await page.evaluate(() => window.filmFixture.presignPending()); await page.waitForFunction(() => !!window.filmFixture.pending); assert.equal(await page.evaluate(() => window.filmFixture.uploads), 1); await finish(); await settled();
      if (mode !== 'success') { await page.getByRole('alert').waitFor(); assert.match(await copy().inputValue(), new RegExp(kind + '-new')); assert.match(await copy().inputValue(), /upload-draft/); }
      else assert.match(await page.getByRole('status').innerText(), /saved and confirmed/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.evaluate(() => window.filmFixture.presigns), 1); assert.equal(await page.evaluate(() => window.filmFixture.calls.length), 1);
     }
     for (const phase of ['presign', 'transfer']) {
      await setup(); await page.evaluate(phase => { window.filmFixture.slowTransfer = phase === 'transfer'; }, phase); await upload(kind);
      if (phase === 'transfer') { await page.evaluate(() => window.filmFixture.presignPending()); await page.waitForFunction(() => !!window.filmFixture.transferPending); }
      await page.evaluate(() => window.filmFixture.remount()); await settled(); await input().fill('/new-upload-context');
      await page.evaluate(phase => phase === 'transfer' ? window.filmFixture.transferPending() : window.filmFixture.presignPending(), phase); await page.clock.runFor(20);
      assert.equal(await page.evaluate(() => window.filmFixture.calls.length), 0); assert.equal(await input().inputValue(), '/new-upload-context');
     }
    }
    for (const mode of ['foreign-upload', 'unregistered-upload']) { await setup(mode); await upload('video'); await page.evaluate(() => window.filmFixture.presignPending()); await page.getByRole('alert').waitFor(); assert.equal(await page.evaluate(() => window.filmFixture.uploads), 0); assert.equal(await page.evaluate(() => window.filmFixture.calls.length), 0); }
    for (const kind of ['film', 'poster']) {
     for (const mode of ['success', 'lost-ack']) {
      await setup(mode); await page.getByRole('button', { name: `Remove ${kind} reference` }).click(); await page.waitForFunction(() => !!window.filmFixture.pending); await finish(); await settled();
      assert.equal(await page.evaluate(kind => window.filmFixture.calls[0][kind === 'film' ? 'featuredFilmVideoUrl' : 'featuredFilmPosterUrl'], kind), null);
      if (mode === 'lost-ack') { await page.getByRole('alert').waitFor(); assert.match(await copy().inputValue(), /null/); } else assert.match(await page.getByRole('status').innerText(), /saved and confirmed/);
     }
    }
    await setup(); await upload('video'); await page.clock.fastForward(600001); await page.getByRole('alert').waitFor(); await page.evaluate(() => window.filmFixture.presignPending()); await page.clock.runFor(10); assert.equal(await page.evaluate(() => window.filmFixture.uploads), 0);
    await setup('conflict', '?combined'); await page.getByLabel('Navigation label').first().fill('Sibling draft'); await start(); await finish(); await page.getByRole('alert').waitFor(); assert.match(await copy().inputValue(), /Sibling draft/); await page.getByLabel('I have preserved my film copy').check(); await page.getByLabel('Navigation label').first().fill('New sibling draft'); assert.equal(await page.getByRole('button', { name: 'Reload saved film' }).isDisabled(), true);
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    console.log(`PASS actual featured-film Chromium ${width}px: revisions, duplicate/frozen saves, 17 held acknowledgements, copy/reload, fetch/JSON/upload timeouts, both replacement/removal paths, prepared reference retention, late presign/transfer/remount, registry/company acknowledgement rejection and sibling draft preservation. Synthetic transport only.`);
   } finally { await page.close(); }
  }
 } finally { await browser.close(); }
}
