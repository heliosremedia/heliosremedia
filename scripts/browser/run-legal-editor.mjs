import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const bundle = await build({ entryPoints: ['scripts/browser/legal-editor-fixture.jsx'], bundle: true, jsx: 'automatic', write: false });
const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
if (process.argv.includes('--bundle-only')) {
  console.log('PASS: legal editor fixture bundled; no browser verification performed');
} else {
  const files = {
    '/': ['text/html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic legal editor</title><link rel="stylesheet" href="/style.css"></head><body style="background:#090909;color:white;padding:16px;max-width:1400px;margin:auto"><main id="root"></main><script src="/fixture.js"></script></body></html>'],
    '/fixture.js': ['text/javascript', bundle.outputFiles[0].contents], '/style.css': ['text/css', css.css],
  };
  const server = createServer((request, response) => {
    const file = files[request.url];
    if (!file || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': file[0], 'Cache-Control': 'no-store' }); response.end(file[1]);
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const { checkLegalEditor } = await import('./legal-editor-check.mjs');
    await checkLegalEditor(`http://127.0.0.1:${server.address().port}`);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
