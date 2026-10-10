import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function syntheticStreamFetch(url: string, init: RequestInit) {
  assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/packet58-synthetic-account/stream?direct_user=true');
  assert.equal(init.method, 'POST');
  const headers = new Headers(init.headers);
  assert.equal(headers.get('authorization'), 'Bearer packet58-synthetic-token');
  assert.equal(headers.get('tus-resumable'), '1.0.0');
  assert.equal(headers.get('upload-length'), '100');
  const metadata = (headers.get('upload-metadata') ?? '').split(',').map((entry): [string, string | undefined] => { const [key, value] = entry.split(' '); return [key, value]; });
  assert.equal(new Set(metadata.map(([key]) => key)).size, metadata.length);
  const fields = new Map(metadata);
  assert.deepEqual([...fields.keys()].filter(key => !['filename', 'filetype', 'name', 'uploadPolicy'].includes(key)).sort(), ['expiry', 'maxDurationSeconds']);
  assert.equal(Buffer.from(fields.get('maxDurationSeconds')!, 'base64').toString(), '180');
  const expiresAt = Date.parse(Buffer.from(fields.get('expiry')!, 'base64').toString());
  assert.ok(Math.abs(expiresAt - Date.now() - 6 * 3600000) < 10000);
  if (fields.has('filename')) {
    assert.equal(Buffer.from(fields.get('filename')!, 'base64').toString(), 'café.mp4');
    assert.equal(Buffer.from(fields.get('filetype')!, 'base64').toString(), 'video/mp4');
    assert.equal(fields.get('name'), undefined);
    assert.equal(Buffer.from(fields.get('uploadPolicy')!, 'base64').toString(), 'standard');
  }
  const uid = randomUUID().replaceAll('-', '');
  return new Response(null, { status: 201, headers: { location: `https://synthetic-upload.invalid/${uid}`, 'stream-media-id': uid } });
}
