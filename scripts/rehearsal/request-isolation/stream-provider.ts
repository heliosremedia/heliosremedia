import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function syntheticStreamFetch(url: string, init: RequestInit) {
  assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/packet58-synthetic-account/stream?direct_user=true');
  assert.equal(init.method, 'POST');
  const headers = new Headers(init.headers);
  assert.equal(headers.get('authorization'), 'Bearer packet58-synthetic-token');
  assert.equal(headers.get('tus-resumable'), '1.0.0');
  assert.equal(headers.get('upload-length'), '100');
  const uid = randomUUID().replaceAll('-', '');
  return new Response(null, { status: 201, headers: { location: `https://synthetic-upload.invalid/${uid}`, 'stream-media-id': uid } });
}
