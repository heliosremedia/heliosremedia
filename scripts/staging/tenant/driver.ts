import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { connect, requestContext } from './context';
import { createSessionToken } from '../../../lib/auth/token';
import { getAdminSession } from '../../../lib/auth/session';
import { getAdminSiteSettings } from '../../../lib/admin-site-settings';
import { getSiteSettings } from '../../../lib/site-settings';
import { getPublicWorkspaceId } from '../../../lib/public-workspace';
import { curationSnapshot } from '../../../lib/homepage-curation-write';
import { PATCH } from '../../../app/api/admin/homepage-projects/route';

const ids = ['packet16-a', 'packet16-b'];
export async function qualify(connection: Parameters<typeof connect>[0]) {
  process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = 'true';
  // Ephemeral in-process sessions only. No password, token or auth secret is persisted.
  process.env.AUTH_SECRET = randomBytes(48).toString('hex');
  const db = connect(connection);
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(1200319)`;
      const existing = await tx.workspace.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
      const tables = await tx.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
      const fixtureTables = new Set(['Workspace', 'AdminUser', 'WorkspaceMembership', 'SiteSettings', 'Project', 'HomepageProject', 'WorkspaceDomain']);
      for (const { tablename } of tables) assert.match(tablename, /^[A-Za-z_][A-Za-z0-9_]*$/);
      const counts = await tx.$queryRawUnsafe<{ name: string; n: bigint }[]>(tables.map(({ tablename }) => `SELECT '${tablename}' name, count(*) n FROM "${tablename}"`).join(' UNION ALL '));
      for (const { name, n } of counts) assert.equal(Number(n), existing.length && fixtureTables.has(name) ? 2 : 0, 'Unexpected data requires review; never adopt or repair');
      if (existing.length) {
        assert.deepEqual(existing.map(w => w.id), ids, 'Unexpected workspace state; no automatic repair');
        for (const id of ids) {
          const user = await tx.adminUser.findUniqueOrThrow({ where: { id: id + '-owner' } });
          assert.equal(user.workspaceId, id); assert.equal(user.email, id + '@example.test');
          assert.equal(user.passwordHash, null);
          assert.equal(user.active, true); assert.equal(user.role, 'OWNER'); assert.equal(user.sessionVersion, 1);
          const membership = await tx.workspaceMembership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: id, userId: user.id } } });
          assert.equal(membership.status, 'ACTIVE'); assert.equal(membership.role, 'OWNER');
          assert.equal((await tx.siteSettings.findUniqueOrThrow({ where: { workspaceId: id } })).id, id + '-settings');
          assert.equal((await tx.project.findUniqueOrThrow({ where: { id: id + '-project' } })).workspaceId, id);
          assert.equal((await tx.homepageProject.findUniqueOrThrow({ where: { id: id + '-placement' } })).projectId, id + '-project');
          assert.equal((await tx.workspaceDomain.findUniqueOrThrow({ where: { hostname: id + '.example.test' } })).workspaceId, id);
        }
        return;
      }
      // No legacy or production rows may be silently adopted by the fixture.
      for (const id of ids) {
        await tx.workspace.create({ data: { id, slug: id, name: 'Synthetic ' + id } });
        await tx.adminUser.create({ data: { id: id + '-owner', email: id + '@example.test', displayName: 'Synthetic owner', role: 'OWNER', workspaceId: id, disciplines: [], sessionVersion: 1 } });
        await tx.workspaceMembership.create({ data: { workspaceId: id, userId: id + '-owner', role: 'OWNER', status: 'ACTIVE' } });
        await tx.siteSettings.create({ data: { id: id + '-settings', workspaceId: id, businessName: 'Synthetic ' + id, bookingMode: 'UNAVAILABLE', bookingHandoffEnabled: false, bookingRequestEnabled: false, bookingPhoneVisible: false, bookingEmailVisible: false } });
        await tx.project.create({ data: { id: id + '-project', workspaceId: id, title: 'Synthetic project', slug: id + '-project', status: 'PUBLISHED' } });
        await tx.homepageProject.create({ data: { id: id + '-placement', projectId: id + '-project', titleOverride: 'Synthetic initial' } });
        await tx.workspaceDomain.create({ data: { workspaceId: id, hostname: id + '.example.test', purpose: 'PUBLIC_SITE', status: 'ACTIVE' } });
      }
    }, { timeout: 60000 });
    const checks: string[] = [];
    for (const id of ids) {
      const other = ids.find(x => x !== id)!;
      const token = createSessionToken({ userId: id + '-owner', email: id + '@example.test', displayName: 'Synthetic owner', role: 'OWNER', sessionVersion: 1 });
      await requestContext.run({ host: id + '.example.test', token }, async () => {
        const session = await getAdminSession(); assert.equal(session?.workspaceId, id);
        assert.equal((await getAdminSiteSettings(session!.workspaceId)).settings.id, id + '-settings');
        assert.equal(await getPublicWorkspaceId(), id);
        assert.equal((await getSiteSettings()).id, id + '-settings');
        const before = await curationSnapshot(db, id, 'projects');
        assert.deepEqual(before.ids, [id + '-placement']); assert.ok(!before.ids.includes(other + '-placement'));
        const untouched = await db.homepageProject.findUniqueOrThrow({ where: { id: other + '-placement' } });
        const write = (revision: string, placementId: string, titleOverride: string) => PATCH(new Request('https://' + id + '.example.test/api/admin/homepage-projects', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-curation-revision': revision, 'x-curation-request': randomUUID() }, body: JSON.stringify({ placementId, titleOverride }) }));
        assert.equal((await write(before.revision, other + '-placement', 'Must not cross')).status, 404);
        const attempts = await Promise.all(['one', 'two'].map(title => write(before.revision, id + '-placement', 'Synthetic ' + title)));
        assert.deepEqual(attempts.map(r => r.status).sort(), [200, 409]);
        const acknowledgement = (await attempts.find(r => r.status === 200)!.json()).acknowledgement;
        const after = await curationSnapshot(db, id, 'projects');
        assert.equal(acknowledgement.workspaceId, id); assert.equal(acknowledgement.previousRevision, before.revision);
        assert.equal(acknowledgement.revision, after.revision); assert.notEqual(after.revision, before.revision);
        assert.equal((await write(before.revision, id + '-placement', 'Stale')).status, 409);
        assert.deepEqual(await db.homepageProject.findUniqueOrThrow({ where: { id: other + '-placement' } }), untouched);
        checks.push(id + ':session/settings/public-host/read-scope/foreign404/concurrent200+409/stale409/acknowledgement');
      });
    }
    await requestContext.run({ host: 'unknown.example.test' }, async () => {
      assert.equal(await getAdminSession(), null);
      await assert.rejects(getPublicWorkspaceId());
      assert.equal((await PATCH(new Request('https://unknown.example.test/api/admin/homepage-projects', { method: 'PATCH', body: '{}' }))).status, 403);
    });
    return { fixtureVersion: 1, workspaces: ids, checks, authentication: 'signed synthetic sessions with request-context adapter', transport: 'actual route/service functions; not hosted HTTP', providerCalls: 'none in exercised path' };
  } finally { await db.$disconnect(); delete process.env.AUTH_SECRET; }
}
