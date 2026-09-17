import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const bundle = await build({ entryPoints: ['scripts/browser/settings-editor-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
  plugins: [{ name: 'synthetic-settings-defaults', setup(builder) {
    builder.onLoad({ filter: /\/lib\/site-settings\.ts$/ }, async args => ({ loader: 'ts',
      contents: (await readFile(args.path, 'utf8')).replace(/^import .*;\n/gm, '').split('export async function getSiteSettings')[0],
    }));
  } }],
});
const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
if (process.argv.includes('--bundle-only')) {
  console.log('PASS: settings editor fixture bundled; no browser verification performed');
} else {
  const files = {
    '/': ['text/html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic settings editors</title><link rel="stylesheet" href="/style.css"></head><body style="background:#090909;color:white;padding:16px;max-width:1400px;margin:auto"><main id="root"></main><script src="/fixture.js"></script></body></html>'],
    '/fixture.js': ['text/javascript', bundle.outputFiles[0].contents], '/style.css': ['text/css', css.css],
  };
  const server = createServer((request, response) => {
    const file = files[request.url.split('?')[0]];
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
    if (!file) { response.writeHead(200, { 'Content-Type': 'image/svg+xml' }); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'); return; }
    response.writeHead(200, { 'Content-Type': file[0], 'Cache-Control': 'no-store' }); response.end(file[1]);
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const { checkSettingsEditor } = await import('./settings-editor-check.mjs');
    await checkSettingsEditor(`http://127.0.0.1:${server.address().port}`);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
