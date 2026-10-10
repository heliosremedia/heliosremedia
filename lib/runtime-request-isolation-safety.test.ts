import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';
import { DATABASE, requireDatabase, requireOrigin } from '../scripts/rehearsal/request-isolation/safety.mjs';
import { http } from '../scripts/rehearsal/request-isolation/http.mjs';

test('runtime rehearsal accepts only its fixed disposable database and explicit loopback port', () => {
  assert.equal(requireDatabase(DATABASE), DATABASE);
  for (const value of [undefined, '', DATABASE.replace('helios_packet19', 'helios_v2_staging'), DATABASE.replace('127.0.0.1', 'localhost'), DATABASE + '?sslmode=require']) {
    assert.throws(() => requireDatabase(value));
  }
  assert.equal(requireOrigin('http://127.0.0.1:43210'), 'http://127.0.0.1:43210');
  for (const value of ['https://127.0.0.1:43210', 'http://example.test:43210', 'http://user@127.0.0.1:43210', 'http://127.0.0.1:43210/path', 'http://127.0.0.1:43210/?target=remote']) {
    assert.throws(() => requireOrigin(value));
  }
});

test('actual entrypoint without explicit disposable target fails before source preparation or database access', () => {
  const result = spawnSync(process.execPath, ['scripts/rehearsal/request-isolation/run.mjs'], {
    env: { PATH: process.env.PATH, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1); assert.match(result.stderr, /Only the fixed disposable Packet 19 database/);
  assert.doesNotMatch(result.stdout, /PASS/);
});

test('HTTP transport preserves the explicit virtual host and does not follow a redirect', async () => {
  const seen: string[] = [];
  const server = createServer((request, response) => {
    seen.push(request.headers.host || ''); response.writeHead(302, { location: 'https://never-contact.example.test/' }); response.end('synthetic');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const result = await http(`http://127.0.0.1:${address.port}`, 'a.example.test');
    assert.equal(result.status, 302); assert.equal(result.text, 'synthetic'); assert.deepEqual(seen, ['a.example.test']);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
