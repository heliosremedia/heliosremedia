import assert from 'node:assert/strict';
import { chromium } from 'playwright';

export async function checkSettingsEditor(base) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [], unexpected = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('dialog', dialog => dialog.accept());
      await page.route('**/*', async route => {
        if (new URL(route.request().url()).origin !== base || route.request().method() !== 'GET') {
          unexpected.push(route.request().url()); await route.abort(); return;
        }
        await route.continue();
      });
      await page.clock.install();
      const labels = { global: 'Save settings', homepage: 'Save Homepage Settings', navigation: 'Save navigation', structure: 'Save structure' };
      const region = form => page.locator(`[data-editor="${form}"]`);
      const save = form => region(form).getByRole('button', { name: labels[form], exact: true });
      const input = form => region(form).getByLabel({ global: 'Business name', homepage: 'Poster alt text', navigation: 'Navigation label', structure: 'Card title' }[form], { exact: true }).first();
      const setup = async (form, mode = 'success') => {
        await page.goto(`${base}/?form=${form}`); await save(form === 'combined' ? 'navigation' : form).waitFor();
        await page.evaluate(mode => { window.settingsFixture.mode = mode; }, mode);
      };
      const start = async form => {
        await save(form).evaluate(node => { node.click(); node.click(); });
        await page.waitForFunction(() => !!window.settingsFixture.pending);
        assert.equal(await input(form).isDisabled(), true);
        assert.equal(await page.evaluate(() => window.settingsFixture.calls.length), 1);
        assert.equal(await page.evaluate(() => window.settingsFixture.calls[0].headers['x-helios-settings-revision']), '1');
      };
      const finish = () => page.evaluate(() => window.settingsFixture.pending());
      try {
        for (const form of Object.keys(labels)) {
          await setup(form); await input(form).fill('Retain this settings edit');
          await start(form); await finish(); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"],fieldset[disabled]'));
          assert.equal(await input(form).inputValue(), 'Retain this settings edit');
          assert.match(await region(form).getByRole('status').last().innerText(), /saved|published/i);
          await input(form).fill('Next revision edit'); await save(form).click(); await page.waitForFunction(() => !!window.settingsFixture.pending);
          assert.equal(await page.evaluate(() => window.settingsFixture.calls[1].editorRevision.updatedAt), '2026-09-17T00:00:01.000Z');
          await finish(); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"],fieldset[disabled]'));

          for (const mode of ['lost-ack', 'conflict', 'non-json', 'foreign-id', 'foreign-workspace', 'foreign-row', 'wrong-scope', 'wrong-request', 'wrong-prior', 'stale', 'invalid-revision', 'legacy']) {
            await setup(form, mode); await input(form).fill('Keep my uncertain edit');
            await start(form); await finish(); await page.getByRole('alert').waitFor();
            assert.match(await page.getByRole('alert').innerText(), mode === 'conflict' ? /changed since/ : /uncertain/);
            assert.doesNotMatch(await page.getByRole('alert').innerText(), /PRIVATE/);
            assert.equal(await save(form).isDisabled(), true);
            if (form === 'global') {
              assert.equal(await page.getByLabel('Independent brand tool', { exact: true }).isEnabled(), true);
              assert.equal(await page.getByLabel('Independent legal tool', { exact: true }).isEnabled(), true);
            }
            const copy = page.getByLabel('Unsaved settings copy', { exact: true });
            assert.match(await copy.inputValue(), /Keep my uncertain edit/);
            await copy.focus(); assert.equal(await copy.evaluate(node => node.selectionEnd === node.value.length), true);
            const reload = page.getByRole('button', { name: 'Reload saved settings' });
            assert.equal(await reload.isDisabled(), true);
            await page.getByLabel('I have preserved my settings copy').check();
            await reload.focus(); assert.equal(await page.evaluate(() => window.settingsFixture.calls.length), 1);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await Promise.all([page.waitForEvent('load'), page.keyboard.press('Enter')]);
            await save(form).waitFor(); assert.equal(await page.evaluate(() => window.settingsFixture.calls.length), 0);
          }
          await setup(form); await input(form).fill('Timeout draft'); await start(form);
          await page.clock.fastForward(30001); await page.getByRole('alert').waitFor(); await finish(); await page.clock.runFor(10);
          assert.equal(await save(form).isDisabled(), true);
          await setup(form, 'slow-json'); await input(form).fill('Old instance'); await start(form); await finish();
          await page.waitForFunction(() => !!window.settingsFixture.jsonPending);
          await page.clock.fastForward(30001); await page.getByRole('alert').waitFor();
          await page.evaluate(() => window.settingsFixture.remount()); await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
          await input(form).fill('New instance draft'); await page.evaluate(() => window.settingsFixture.jsonPending()); await page.clock.runFor(10);
          assert.equal(await input(form).inputValue(), 'New instance draft');
          assert.equal(await page.evaluate(() => window.settingsFixture.calls.length), 1);
          console.log(`PASS: actual settings ${form} Chromium ${width}px: duplicate/frozen input, authoritative revision advancement, twelve held outcomes, retained-copy reload, fetch/JSON timeouts and late remount settlement; synthetic fetch only`);
        }
        // All three real homepage editors share manual recovery copies without discarding sibling drafts.
        await setup('combined', 'conflict');
        await input('navigation').fill('Retained navigation'); await input('homepage').fill('Retained homepage'); await input('structure').fill('Retained structure');
        await start('navigation'); await finish(); await page.getByRole('alert').waitFor();
        const copy = page.getByLabel('Unsaved settings copy', { exact: true });
        assert.match(await copy.inputValue(), /Retained navigation/); assert.match(await copy.inputValue(), /Retained homepage/); assert.match(await copy.inputValue(), /Retained structure/);
        await page.getByLabel('I have preserved my settings copy').check();
        await input('structure').fill('Newer sibling draft');
        assert.equal(await page.getByRole('button', { name: 'Reload saved settings' }).isDisabled(), true);
        assert.match(await copy.inputValue(), /Newer sibling draft/);

        // Late upload preparations cannot publish into a new editor or clobber edits.
        for (const [form, index] of [['global', 0], ['global', 1], ['homepage', 0], ['homepage', 1], ['homepage', 2], ['homepage', 3]]) {
          await setup(form); await input(form).fill('Draft before upload');
          const file = region(form).locator('input[type="file"]').nth(index);
          await file.setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('synthetic-only') });
          await page.waitForFunction(() => !!window.settingsFixture.presignPending);
          assert.equal(await input(form).isDisabled(), true);
          await page.evaluate(() => window.settingsFixture.presignPending()); await page.waitForFunction(() => !!window.settingsFixture.pending);
          assert.equal(await page.evaluate(() => window.settingsFixture.uploads), 1);
          assert.equal(await page.evaluate(() => window.settingsFixture.calls[0].editorRevision.updatedAt), '2026-09-17T00:00:00.000Z');
          await finish(); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"],fieldset[disabled]'));
          assert.equal(await input(form).inputValue(), 'Draft before upload');
          await setup(form, 'lost-ack'); await input(form).fill('Draft retained with uploaded media');
          await file.setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('synthetic-only') });
          await page.waitForFunction(() => !!window.settingsFixture.presignPending); await page.evaluate(() => window.settingsFixture.presignPending());
          await page.waitForFunction(() => !!window.settingsFixture.pending); await finish(); await page.getByRole('alert').waitFor();
          const uploadedCopy = await page.getByLabel('Unsaved settings copy', { exact: true }).inputValue();
          assert.match(uploadedCopy, /Draft retained with uploaded media/); assert.match(uploadedCopy, /synthetic-image.svg/);
          assert.equal(await page.evaluate(() => window.settingsFixture.calls.length), 1);
          await setup(form);
          await file.setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('synthetic-only') });
          await page.waitForFunction(() => !!window.settingsFixture.presignPending);
          await page.evaluate(() => window.settingsFixture.remount()); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"],fieldset[disabled]'));
          await input(form).fill('Draft after upload remount'); await page.evaluate(() => window.settingsFixture.presignPending());
          await page.waitForTimeout(20);
          assert.equal(await page.evaluate(() => window.settingsFixture.uploads), 0);
          assert.equal(await page.evaluate(() => window.settingsFixture.calls.length), 0);
          assert.equal(await input(form).inputValue(), 'Draft after upload remount');
        }
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        console.log(`PASS: settings Chromium ${width}px: sibling drafts copied together, new sibling edit invalidates reload confirmation, upload admission and late preparation containment; no provider request`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
}
