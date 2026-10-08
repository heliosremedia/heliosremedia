import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { http } from './http.mjs';
import { requireDatabase } from './safety.mjs';

export async function qualifyWorkspaceLifecyclePublic(origin, driver) {
  requireDatabase(process.env.PACKET19_DATABASE_URL);
  const db = driver.prisma, cases = [];
  assert.equal(await db.platformLifecycleOperator.count(), 0);
  const projects = await db.project.findMany({ orderBy: { id: 'asc' } });
  const pages = ['/', '/about', '/portfolio', '/portfolio/gallery', '/portfolio/films', '/services', '/privacy', '/sitemap.xml'];
  const apis = ['/api/portfolio/gallery', '/api/portfolio/films', '/api/inquiries', '/api/client-portal/register', '/api/client-portal/challenge', '/api/client-portal/verify'];
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const read = (path, method = 'GET', body, headers = {}) => http(origin, `${id}.example.test`, path, {
      method, headers: { 'x-forwarded-host': `${other}.example.test`, 'x-workspace-id': other, ...headers }, ...(body === undefined ? {} : { body }),
    });
    assert.equal((await read('/')).status, 200); // warm render before suspension
    const email = `lifecycle-optout-${id}@example.test`;
    const preference = await db.workspaceMarketingPreference.create({ data: { workspaceId: id, normalizedEmail: email, status: 'SUBSCRIBED', source: 'SYNTHETIC_LIFECYCLE' } });
    const foreign = await db.workspaceMarketingPreference.create({ data: { workspaceId: other, normalizedEmail: email, status: 'SUBSCRIBED', source: 'SYNTHETIC_LIFECYCLE' } });
    const token = `v2.${randomBytes(32).toString('base64url')}`;
    await db.workspaceMarketingPreferenceToken.create({ data: { workspaceId: id, preferenceId: preference.id, tokenHash: createHash('sha256').update(token).digest('hex'), source: 'SYNTHETIC_LIFECYCLE', expiresAt: new Date(Date.now() + 600000) } });
    const actor = { userId: `u${other}`, workspaceId: other, sessionVersion: 1 };
    await db.platformLifecycleOperator.create({ data: { userId: actor.userId, enabled: true } });
    const transition = async state => driver.transitionWorkspaceLifecycle(db, actor, { workspaceId: id, expectedRevision: (await db.workspace.findUniqueOrThrow({ where: { id } })).lifecycleRevision, state, reason: 'Synthetic public admission qualification' });
    try {
      await transition('SUSPENDED');
      for (const path of [...pages, ...apis]) {
        const method = ['/api/inquiries', '/api/client-portal/register', '/api/client-portal/challenge', '/api/client-portal/verify'].includes(path) ? 'POST' : 'GET';
        const response = await read(path, method, method === 'POST' ? {} : undefined);
        assert.equal(response.status, 503, `${path}: ${response.text}`);
        assert.equal(response.text, 'This site is temporarily unavailable.');
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.headers.location, undefined);
      }
      const head = await read('/', 'HEAD'); assert.equal(head.status, 503); assert.equal(head.text, '');
      const flight = await read('/portfolio', 'GET', undefined, { rsc: '1', 'next-router-prefetch': '1' });
      assert.equal(flight.status, 503); assert.equal(flight.text, 'This site is temporarily unavailable.');
      const active = await http(origin, `${other}.example.test`, '/');
      assert.equal(active.status, 200); assert.ok(active.text.includes(`PACKET19 COMPANY ${other}`));
      assert.equal((await read('/login')).status, 200);
      const form = await read('/unsubscribe'); assert.equal(form.status, 200);
      assert.ok(form.text.includes('Email preferences')); assert.ok(!form.text.includes('PACKET19 COMPANY'));
      // Authority remains the stored signed-token binding, even with a forged
      // company selector or attempted resubscribe in the public request body.
      const optout = await read('/api/unsubscribe', 'POST', { token, workspaceId: other, status: 'SUBSCRIBED' });
      assert.equal(optout.status, 200, optout.text);
      assert.equal((await db.workspaceMarketingPreference.findUniqueOrThrow({ where: { id: preference.id } })).status, 'UNSUBSCRIBED');
      assert.deepEqual(await db.workspaceMarketingPreference.findUniqueOrThrow({ where: { id: foreign.id } }), foreign);
      assert.equal((await read('/api/unsubscribe', 'POST', { token: 'v2.invalid' })).status, 400);
      const events = await db.workspaceMarketingPreferenceEvent.count({ where: { preferenceId: preference.id } });
      assert.equal((await read('/api/unsubscribe', 'POST', { token })).status, 200);
      assert.equal(await db.workspaceMarketingPreferenceEvent.count({ where: { preferenceId: preference.id } }), events);
      await transition('ACTIVE');
      const resumed = await read('/'); assert.equal(resumed.status, 200); assert.ok(resumed.text.includes(`PACKET19 COMPANY ${id}`));
      assert.equal((await db.workspaceMarketingPreference.findUniqueOrThrow({ where: { id: preference.id } })).status, 'UNSUBSCRIBED');
      cases.push({ tenant: id, paths503: [...pages, ...apis], noStore: true, noTenantContent: true, forgedSelectorsIgnored: true,
        headAndRsc503: true, otherTenant200: true, loginAndOptoutPage200: true, scopedOptout200: true, foreignPreferenceUnchanged: true,
        invalidToken400: true, replayIdempotent: true, reactivation200: true, optoutPreservedAfterReactivation: true });
    } finally {
      if ((await db.workspace.findUniqueOrThrow({ where: { id } })).lifecycleState === 'SUSPENDED') await transition('ACTIVE');
      await db.platformLifecycleOperator.delete({ where: { userId: actor.userId } });
    }
  }
  assert.deepEqual(await db.project.findMany({ orderBy: { id: 'asc' } }), projects);
  assert.equal(await db.platformLifecycleOperator.count(), 0);
  assert.equal(await db.workspace.count({ where: { lifecycleState: 'ACTIVE' } }), 2);
  return { cases, syntheticOperatorsRemoved: true, allWorkspacesActive: true, projectRowsUnchanged: true,
    scope: 'host-owned-pages-and-listed-public-apis', hostedCdnAndTokenReferralAndWorkersQualified: false };
}
