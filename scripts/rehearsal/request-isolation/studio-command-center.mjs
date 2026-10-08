import assert from 'node:assert/strict';
import { http } from './http.mjs';

export async function qualifyStudioCommandCenter(origin, driver) {
  const db = driver.prisma, cases = [];
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const marker = id => `STUDIO_PRIVATE_${id.toUpperCase()}`;
  const read = id => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, '/admin/studio?workspaceId=foreign', { headers: { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' } });
  try {
    for (const id of ['a', 'b']) {
      await db.project.create({ data: { id: `studio-project-${id}`, workspaceId: id, slug: `studio-project-${id}`, title: `${marker(id)} project`, status: 'DRAFT' } });
      await db.inquiry.create({ data: { id: `studio-inquiry-${id}`, workspaceId: id, name: `${marker(id)} inquiry`, email: `studio-${id}@example.test`, status: 'NEW', createdAt: new Date('2000-01-01') } });
    }
    for (const id of ['a', 'b', 'a', 'b']) {
      const reply = await read(id);
      assert.equal(reply.status, 200);
      assert.ok(reply.text.includes('Command Center'));
      assert.ok(reply.text.includes(`${marker(id)} project`));
      assert.ok(reply.text.includes(`${marker(id)} inquiry`));
      assert.ok(reply.text.includes(`/admin/projects/studio-project-${id}`));
      assert.ok(!reply.text.includes(marker(id === 'a' ? 'b' : 'a')));
      assert.ok(!reply.text.includes('Attention data is unavailable'));
      assert.ok(!reply.text.includes('Project data is unavailable'));
    }
    for (const [index, reply] of (await Promise.all(['a', 'b'].map(read))).entries()) {
      assert.equal(reply.status, 200); assert.ok(!reply.text.includes(marker(index === 0 ? 'b' : 'a')));
    }
    assert.equal((await http(origin, 'a.example.test', '/admin/studio')).status, 307);
    for (const id of ['a', 'b']) {
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      await db.workspaceMembership.update({ where, data: { role: 'VIEWER' } });
      const viewer = await read(id); assert.equal(viewer.status, 404); assert.ok(!viewer.text.includes(marker(id)));
      await db.workspaceMembership.update({ where, data: { role: 'OWNER', status: 'REVOKED' } });
      assert.equal((await read(id)).status, 307);
      await db.workspaceMembership.update({ where, data: { status: 'ACTIVE' } });
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
      assert.equal((await read(id)).status, 307);
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
      assert.equal((await read(id)).status, 200);
      cases.push({ tenant: id, ownedProjectsAndAttentionRendered: true, foreignHostHeaderAndQueryIgnored: true, anonymousDenied: true, currentRoleAndRevocationEnforced: true, suspendedDenied: true, restoredAccess: true });
    }
    return { cases, alternatingAndConcurrentReads: true, actualNextHttp: true, providerCalls: false, scope: 'read-only shell and overview; module actions retain existing qualification' };
  } finally {
    await db.inquiry.deleteMany({ where: { id: { in: ['studio-inquiry-a', 'studio-inquiry-b'] } } });
    await db.project.deleteMany({ where: { id: { in: ['studio-project-a', 'studio-project-b'] } } });
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: { lifecycleState: row.lifecycleState, lifecycleRevision: row.lifecycleRevision, lastReactivatedAt: row.lastReactivatedAt, updatedAt: row.updatedAt } });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
