import assert from 'node:assert/strict';
import { http } from './http.mjs';

export async function qualifyStudioProjectMedia(origin, driver) {
  const db = driver.prisma, cases = [];
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const marker = id => `STUDIO_MEDIA_PRIVATE_${id.toUpperCase()}`;
  const read = (id, path) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, path, { headers: { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' } });
  const visibleText = reply => reply.text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const projectIds = ['studio-media-project-a', 'studio-media-project-b'];
  try {
    for (const id of ['a', 'b']) {
      await db.project.create({ data: { id: `studio-media-project-${id}`, workspaceId: id, slug: `studio-media-project-${id}`, title: `${marker(id)} project`, status: 'DRAFT' } });
      for (let n = 0; n < (id === 'a' ? 2 : 3); n++) await db.media.create({ data: {
        id: `studio-media-${id}-${n}`, projectId: `studio-media-project-${id}`, serviceId: `s${id}`, sourceType: 'UPLOADED_IMAGE', mediaCategory: 'PHOTOGRAPHY', visibility: n === 0 ? 'VISIBLE' : 'HIDDEN', originalFilename: `${marker(id)}_${n}.jpg`, storageKey: `projects/studio-media-project-${id}/${n}.jpg`,
      } });
    }
    for (const id of ['a', 'b', 'a', 'b']) {
      const other = id === 'a' ? 'b' : 'a';
      for (const path of ['/admin/media?workspaceId=foreign', `/admin/media?search=${marker(id)}`, `/admin/media?project=studio-media-project-${id}`, '/admin/media?visibility=HIDDEN&category=PHOTOGRAPHY&page=999999']) {
        const reply = await read(id, path);
        assert.equal(reply.status, 200, path);
        assert.ok(reply.text.includes(marker(id)), path);
        assert.ok(!reply.text.includes(marker(other)), path);
        const text = visibleText(reply);
        const count = await db.media.count({ where: { project: { workspaceId: id } } });
        assert.ok(text.includes(`Total assets ${count} In this workspace`), text.slice(0, 400));
      }
      const foreign = await read(id, `/admin/media?project=studio-media-project-${other}`);
      assert.equal(foreign.status, 404); assert.ok(!foreign.text.includes(marker(other)));
      assert.equal((await read(id, '/admin/media?project=missing-project')).status, 404);
      const empty = await read(id, '/admin/media?search=definitely-no-such-media');
      assert.equal(empty.status, 200); assert.ok(empty.text.includes('No assets match these filters.'));
      const project = await read(id, '/admin/projects');
      assert.equal(project.status, 200); assert.ok(!project.text.includes(marker(other)));
      const projectCount = await db.project.count({ where: { workspaceId: id } });
      assert.ok(visibleText(project).includes(`Total ${projectCount} All portfolio projects`));
      const selected = await read(id, `/admin/media?project=studio-media-project-${id}`);
      assert.ok(selected.text.includes(`/admin/projects/studio-media-project-${id}#project-media`));
      assert.equal((await read(id, `/admin/projects/studio-media-project-${id}`)).status, 200);
      assert.equal((await read(id, `/admin/projects/studio-media-project-${other}`)).status, 404);
    }
    await Promise.all(['a', 'b'].map(async id => {
      const reply = await read(id, '/admin/media');
      assert.ok(reply.text.includes(marker(id))); assert.ok(!reply.text.includes(marker(id === 'a' ? 'b' : 'a')));
    }));
    assert.equal((await http(origin, 'a.example.test', '/admin/media')).status, 307);
    for (const id of ['a', 'b']) {
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      await db.workspaceMembership.update({ where, data: { status: 'REVOKED' } });
      const revoked = await read(id, '/admin/media'); assert.equal(revoked.status, 307); assert.ok(!revoked.text.includes(marker(id)));
      await db.workspaceMembership.update({ where, data: { status: 'ACTIVE' } });
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
      const suspended = await read(id, '/admin/media'); assert.equal(suspended.status, 307); assert.ok(!suspended.text.includes(marker(id)));
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
      cases.push({ tenant: id, ownedMediaAndCounts: true, searchAndFiltersScoped: true, foreignProject404: true, missingProject404: true, projectTotalsScoped: true, directOwnedEditor200: true, directForeignEditor404: true, revokedAndSuspendedDenied: true });
    }
    return { cases, alternatingAndConcurrentReads: true, actualNextHttp: true, providerCalls: false, scope: 'workspace library and project discovery; existing mutation and upload guards unchanged' };
  } finally {
    await db.media.deleteMany({ where: { projectId: { in: projectIds } } });
    await db.project.deleteMany({ where: { id: { in: projectIds } } });
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: { lifecycleState: row.lifecycleState, lifecycleRevision: row.lifecycleRevision, lastReactivatedAt: row.lastReactivatedAt, updatedAt: row.updatedAt } });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
