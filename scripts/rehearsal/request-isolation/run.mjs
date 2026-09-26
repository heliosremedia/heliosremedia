import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, writeFile, symlink, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { DATABASE, requireDatabase, requireOrigin } from './safety.mjs';
import { qualify } from './http.mjs';
import { qualifyPortfolio } from './portfolio.mjs';
import { qualifyPreviewFencing } from './preview-fencing.mjs';
import { qualifyWebhook, WEBHOOK_KEY } from './webhook.mjs';

const root = process.cwd();
const prepareOnly = process.argv[2] === '--prepare-only';
assert.ok(process.argv.length === (prepareOnly ? 3 : 2));
requireDatabase(process.env.PACKET19_DATABASE_URL);
const noEnvironments = async dir => assert.equal((await readdir(dir)).filter(name => /^\.env(?:\.|$)/.test(name) && name !== '.env.example').length, 0, 'Runtime environment files forbidden');
await noEnvironments(root);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!prepareOnly) execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { stdio: 'ignore' });
const scratch = await mkdtemp(join(tmpdir(), 'helios-packet19-'));
const app = join(scratch, 'app');
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: process.env.CI,
  NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: DATABASE, DIRECT_URL: DATABASE, PACKET19_DATABASE_URL: DATABASE,
  AUTH_SECRET: 'packet19-synthetic-isolated-session-secret-only', STUDIO_V2_TENANT_CONTEXT_ENABLED: 'true',
  R2_ACCOUNT_ID: 'synthetic', R2_ACCESS_KEY_ID: 'synthetic', R2_SECRET_ACCESS_KEY: 'synthetic', R2_BUCKET_NAME: 'synthetic',
  R2_PUBLIC_URL: 'http://127.0.0.1:1/assets', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1', LEGACY_PUBLIC_HOSTS: 'never.example.test',
  RESEND_WEBHOOK_SECRET: `whsec_${WEBHOOK_KEY}` };
let child, driver, logs = '';
async function command(executable, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const process = spawn(executable, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }); let output = '';
    const append = chunk => { output = (output + chunk).slice(-12000); };
    process.stdout.on('data', append); process.stderr.on('data', append);
    process.on('error', reject); process.on('close', code => code === 0 ? resolve(output) : reject(new Error(`Isolated command failed (${code}): ${output}`)));
  });
}
async function prepare() {
  await mkdir(app);
  // Archive only the exact committed source. Extract into a disposable directory.
  await new Promise((resolve, reject) => {
    const archive = spawn('git', ['archive', head], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const extract = spawn('tar', ['-x', '-C', app], { env, stdio: ['pipe', 'ignore', 'pipe'] }); archive.stdout.pipe(extract.stdin);
    Promise.all([archive, extract].map(p => new Promise((done, fail) => { p.on('error', fail); p.on('close', code => code === 0 ? done() : fail(new Error('Source archive failed'))); }))).then(resolve, reject);
  });
  await noEnvironments(app);
  await symlink(join(root, 'node_modules'), join(app, 'node_modules'), 'dir');
  await symlink(join(root, 'node_modules'), join(scratch, 'node_modules'), 'dir');
  await cp(join(root, 'app/generated'), join(app, 'app/generated'), { recursive: true });
  // Explicit rehearsal substitutions only: local PostgreSQL transport and offline fonts.
  await writeFile(join(app, 'lib/prisma.ts'), `import {PrismaPg} from '@prisma/adapter-pg';import {PrismaClient} from '@/app/generated/prisma/client';export const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});`);
  const layout = await readFile(join(app, 'app/layout.tsx'), 'utf8');
  const fontImport = 'import { Cormorant_Garamond, Inter } from "next/font/google";';
  assert.ok(layout.includes(fontImport), 'Font substitution must match reviewed source');
  await writeFile(join(app, 'app/layout.tsx'), layout.replace(fontImport, 'const Cormorant_Garamond = (_options: unknown) => ({variable:""}); const Inter = (_options: unknown) => ({variable:""});'));
  const bundle = join(scratch, 'driver.mjs');
  await build({ entryPoints: [join(root, 'scripts/rehearsal/request-isolation/driver.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  return bundle;
}
try {
  const bundle = await prepare();
  if (prepareOnly) console.log('PASS isolated source preparation and driver bundle; database/server not executed');
  else {
    // Parent driver receives only the two fixed synthetic settings it consumes.
    process.env.PACKET19_DATABASE_URL = DATABASE; process.env.AUTH_SECRET = env.AUTH_SECRET;
    driver = await import(pathToFileURL(bundle));
    await driver.requireEmpty();
    await command(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push'], app);
    await driver.seed(); const schemaBefore = await driver.schemaFingerprint();
    console.log('PASS empty disposable database admission and synthetic two-tenant seed');
    console.log((await command(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], app)).slice(-1000));
    const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: app, env: { ...env, NODE_ENV: 'production' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const append = chunk => { logs = (logs + chunk).slice(-12000); }; child.stdout.on('data', append); child.stderr.on('data', append);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Next start timeout')), 90000);
      const ready = () => { if (/Ready in/.test(logs)) { clearTimeout(timer); child.stdout.off('data', ready); resolve(); } };
      child.stdout.on('data', ready); child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Next exited ${code}`)); });
    });
    const origin = requireOrigin(`http://127.0.0.1:${port}`);
    const result = await qualify(origin, driver);
    const portfolio = await qualifyPortfolio(origin, driver);
    const previewFencing = await qualifyPreviewFencing(origin, driver);
    const webhook = await qualifyWebhook(origin, driver);
    assert.equal(await driver.schemaFingerprint(), schemaBefore);
    assert.equal(await driver.prisma.workspace.count(), 2);
    assert.equal(await driver.prisma.workspaceMembership.count({ where: { status: 'ACTIVE' } }), 2);
    assert.equal(await driver.prisma.adminUser.count({ where: { sessionVersion: 1 } }), 2);
    await mkdir('release-evidence', { recursive: true });
    await writeFile('release-evidence/request-isolation.json', JSON.stringify({ version: 1, candidate: head, runtime: 'Next build/start with PrismaPg',
      target: 'disposable-local-postgresql', sourceSubstitutions: ['PrismaNeon to PrismaPg', 'offline font variables'], result, portfolio, previewFencing,
      webhook, schemaColumnsUnchanged: true, syntheticAccessRestored: true, hosted: false, deployable: false }, null, 2) + '\n');
    console.log('PASS actual Next production-mode HTTP: alternating/concurrent tenants, post-write reads, foreign/stale write rejection, membership/session revocation and schema/access postflight');
    console.log('PASS both-direction portfolio published/draft/preview isolation, actual preview creation/revocation, expiry and rejected usage-write containment');
    console.log('PASS actual PostgreSQL lock-observed preview create/revoke: membership revoked after initial session, both tenants reject403 without preview/audit mutation');
  }
} catch (error) { console.error(logs); throw error; }
finally {
  if (child?.exitCode === null) {
    process.kill(-child.pid, 'SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} resolve(); }, 5000).unref(); });
  }
  await driver?.prisma.$disconnect(); await rm(scratch, { recursive: true, force: true });
}
