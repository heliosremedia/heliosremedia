import assert from 'node:assert/strict';
import { chromium } from 'playwright';
export async function checkCurationEditor(base) {
 assert.equal(new URL(base).hostname, '127.0.0.1');
 const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
 try { for (const width of [390,1440]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('dialog', d => d.accept());
  await page.route('**/*', route => new URL(route.request().url()).origin === base && route.request().method() === 'GET' ? (new URL(route.request().url()).pathname.startsWith('/workspaces/') ? route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'}) : route.continue()) : route.abort());
  await page.clock.install();
  const cards = () => page.getByRole('region', { name: 'Work cards editor', exact: true });
  const projects = () => page.getByRole('region', { name: 'Featured project editor', exact: true });
  const save = () => cards().getByRole('button', { name: 'Save card', exact: true }).first();
  const title = () => cards().getByLabel('Card title', { exact: true }).first();
  const copy = () => cards().getByLabel('Retained homepage drafts', { exact: true });
  const setup = async (mode = 'success') => { await page.goto(base); await save().waitFor(); await page.evaluate(mode => { window.curationFixture.mode = mode; }, mode); };
  const pending = () => page.waitForFunction(() => !!window.curationFixture.pending);
  const finish = () => page.evaluate(() => window.curationFixture.pending());
  try {
   await setup(); await title().fill('Frozen'); await save().evaluate(n => { n.click(); n.click(); }); await pending(); assert.equal(await page.evaluate(() => window.curationFixture.calls.length), 1);
   await title().fill('Newer'); await finish(); await save().waitFor(); assert.equal(await title().inputValue(), 'Newer');
   await save().click(); await pending(); assert.equal(await page.evaluate(() => window.curationFixture.calls[1].headers['x-curation-revision']), '1'.padStart(64,'0')); await finish(); await save().waitFor();
   for (const mode of ['lost','non-json','conflict','company','revision','request','identity']) {
    await setup(mode); await title().fill('Keep this'); await cards().getByLabel('Card title', { exact: true }).nth(1).fill('Sibling');
    await projects().getByLabel('Homepage title').fill('Project draft');
    // Blur triggers the independent project save; finish it before testing the card failure.
    await title().focus(); await pending(); await finish(); await page.clock.runFor(10);
    await save().click(); await pending(); await finish(); await copy().waitFor(); assert.match(await copy().inputValue(), /Keep this/); assert.match(await copy().inputValue(), /Sibling/); assert.match(await copy().inputValue(), /Project draft/);
    assert.equal(await save().isDisabled(), true); assert.doesNotMatch(await cards().innerText(), /PRIVATE/);
    const reload = cards().getByRole('button', { name: 'Reload to reconcile' }); assert.equal(await reload.isDisabled(), true);
    await cards().getByLabel('I have retained all drafts shown above.').check(); assert.equal(await reload.isDisabled(), false);
    await title().fill('Later copy'); assert.equal(await reload.isDisabled(), true); await cards().getByLabel('I have retained all drafts shown above.').check();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await Promise.all([page.waitForEvent('load'), reload.click()]); await save().waitFor(); assert.equal(await page.evaluate(() => window.curationFixture.calls.length), 0);
   }
   for (const mode of ['success','lost','order','conflict']) {
    await setup(mode); await cards().getByRole('button', { name: '↓', exact: true }).first().click(); await pending(); await finish(); await page.clock.runFor(10);
    assert.equal(await cards().locator('h3').first().innerText(), 'Service c2'); if (mode !== 'success') await copy().waitFor();
   }
   await setup(); await save().click(); await pending(); await page.clock.fastForward(20001); await copy().waitFor(); await title().fill('After timeout'); await finish(); await page.clock.runFor(10); assert.equal(await title().inputValue(), 'After timeout'); assert.equal(await save().isDisabled(), true);
   await setup('slow-json'); await save().click(); await pending(); await finish(); await page.waitForFunction(() => !!window.curationFixture.jsonPending); await page.clock.fastForward(20001); await copy().waitFor(); await page.evaluate(() => window.curationFixture.remount()); await save().waitFor(); await title().fill('New instance'); await page.evaluate(() => window.curationFixture.jsonPending()); await page.clock.runFor(10); assert.equal(await title().inputValue(), 'New instance');
   for (const mode of ['success','lost','attachment-asset','attachment-parent','conflict']) {
    await setup(mode); await title().fill('Upload draft'); await cards().locator('input[type=file]').nth(1).setInputFiles({ name: 'test.webp', mimeType: 'image/webp', buffer: Buffer.from('synthetic') }); await page.waitForFunction(() => !!window.curationFixture.presignPending); assert.equal(await save().isDisabled(), true);
    await page.evaluate(() => window.curationFixture.presignPending()); await pending(); await finish(); await page.clock.runFor(10); assert.equal(await page.evaluate(() => window.curationFixture.uploads), 1);
    if (mode !== 'success') { await copy().waitFor(); assert.match(await copy().inputValue(), /workspaces\/a\/homepage-work-cards\/c1\/image-test.webp/); assert.match(await copy().inputValue(), /Upload draft/); }
   }
   for(const mode of ['upload-company','upload-card','upload-url','upload-unregistered','upload-parent']) {
    await setup(mode); await cards().locator('input[type=file]').nth(1).setInputFiles({name:'test.webp',mimeType:'image/webp',buffer:Buffer.from('synthetic')});await page.waitForFunction(()=>!!window.curationFixture.presignPending);await page.evaluate(()=>window.curationFixture.presignPending());await copy().waitFor();assert.equal(await page.evaluate(()=>window.curationFixture.uploads),0);assert.equal(await page.evaluate(()=>window.curationFixture.calls.length),0);
   }
   for (const phase of ['presign','transfer']) {
    await setup(); await page.evaluate(phase => { window.curationFixture.slowTransfer = phase === 'transfer'; }, phase);
    await cards().locator('input[type=file]').nth(1).setInputFiles({ name: 'test.webp', mimeType: 'image/webp', buffer: Buffer.from('synthetic') }); await page.waitForFunction(() => !!window.curationFixture.presignPending);
    if (phase === 'transfer') { await page.evaluate(() => window.curationFixture.presignPending()); await page.waitForFunction(() => !!window.curationFixture.transferPending); }
    await page.evaluate(() => window.curationFixture.remount()); await save().waitFor(); await title().fill('New upload context'); await page.evaluate(phase => phase === 'presign' ? window.curationFixture.presignPending() : window.curationFixture.transferPending(), phase); await page.clock.runFor(10); assert.equal(await page.evaluate(() => window.curationFixture.calls.length), 0); assert.equal(await title().inputValue(), 'New upload context');
   }
   await setup('lost'); await cards().getByRole('button', { name: 'Remove', exact: true }).first().click(); await pending(); await finish(); await copy().waitFor(); assert.equal(await cards().locator('h3').count(), 2);
   assert.deepEqual(errors, []); console.log(`PASS: actual curation editors Chromium ${width}px, synthetic transport, ${new Date().toISOString()}`);
  } catch (error) { console.error('Curation fixture diagnostics', { errors, body: (await page.locator('body').innerText()).slice(0,3000) }); throw error; } finally { await page.close(); }
 } } finally { await browser.close(); }
}
