import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { http } from './http.mjs';
import { requireOrigin } from './safety.mjs';
const { encodeReply } = createRequire(import.meta.url)('next/dist/compiled/react-server-dom-webpack/client.node');

// Compose the actual application entry points on one newly created private project.
// Provider provisioning is the existing no-network synthetic runtime substitution.
export async function qualifyStudioPrivateProjectFlow(origin, driver, actionManifest) {
  requireOrigin(origin);
  const db = driver.prisma, cases = [], projects = [], assets = [];
  const actions = Object.entries(actionManifest.node).filter(([, entry]) => Object.keys(entry.workers).some(worker => worker.endsWith('/admin/projects/new/page'))).map(([id]) => id);
  assert.equal(actions.length, 1);
  try {
    for (const id of ['a', 'b']) {
      const other = id === 'a' ? 'b' : 'a', requestId = randomUUID();
      const projectId = `draft_${createHash('sha256').update(JSON.stringify(['studio-draft-v1', id, `u${id}`, requestId])).digest('hex')}`;
      projects.push(projectId);
      const headers = { cookie: driver.cookie(id), 'x-workspace-id': other };
      const route = `/api/admin/projects/${projectId}`;
      const send = (suffix, method, body) => http(origin, `${other}.example.test`, route + suffix, { method, headers, body });
      const form = new FormData();
      const title = `PRIVATE OWNER FLOW ${id}`;
      for (const [key, value] of Object.entries({ requestId, title, slug: `owner-flow-${id}-${requestId}`, shortDescription: 'Private synthetic project', city: 'Fort Collins', state: 'Colorado', locationLabel: '', projectType: 'Listing Media', propertyType: '' })) form.set(key, value);
      const host = `${other}.example.test`;
      const created = await fetch(`${origin}/admin/projects/new`, { method: 'POST', headers: { ...headers, host, 'x-forwarded-host': host, origin: `http://${host}`, 'Next-Action': actions[0], accept: 'text/x-component' }, body: await encodeReply([{ error: null }, form]), redirect: 'manual' });
      assert.equal(created.status, 200); assert.ok((await created.text()).includes(projectId));
      let project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
      assert.equal(project.workspaceId, id); assert.equal(project.status, 'DRAFT');
      const details = await send('/details', 'PATCH', { title, slug: project.slug, shortDescription: 'Reviewed private introduction', city: 'Fort Collins', state: 'Colorado', expectedUpdatedAt: project.updatedAt.toISOString(), agents: [] });
      assert.equal(details.status, 200, details.text);
      const upload = await http(origin, host, route + '/stream-upload', { method: 'POST', headers: { ...headers, 'upload-length': '100', 'tus-resumable': '1.0.0' } });
      assert.equal(upload.status, 201, upload.text);
      const uid = upload.headers['stream-media-id'];
      const asset = await db.workspaceAsset.findFirstOrThrow({ where: { provider: 'CLOUDFLARE_STREAM', providerKey: uid } });
      assets.push(asset.id); assert.equal(asset.workspaceId, id);
      const attached = await send('/media', 'POST', { streamUid: uid, originalFilename: 'Synthetic property tour', mediaCategory: 'PHOTOGRAPHY', serviceId: `s${id}` });
      assert.equal(attached.status, 201, attached.text);
      const media = JSON.parse(attached.text).media;
      const edited = await send('/media', 'PATCH', { action: 'update-asset', mediaId: media.id, expectedUpdatedAt: media.updatedAt, originalFilename: 'Reviewed property tour', altText: 'Synthetic property tour', caption: 'Private owner review only', visibility: 'VISIBLE', serviceId: `s${id}`, mediaCategory: media.mediaCategory, externalUrl: media.externalUrl });
      assert.equal(edited.status, 200, edited.text);
      assert.equal((await db.media.findUniqueOrThrow({ where: { id: media.id } })).assetId, asset.id);
      project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { services: true } });
      const services = await send('/workflow', 'PATCH', { action: 'assign-services', serviceIds: [`s${id}`], expectedServiceIds: project.services.map(row => row.serviceId), expectedUpdatedAt: project.updatedAt.toISOString() });
      assert.equal(services.status, 200, services.text);
      const editor = await http(origin, host, `/admin/projects/${projectId}`, { headers });
      assert.equal(editor.status, 200); assert.ok(editor.text.includes('Review privately')); assert.ok(editor.text.includes('Services assigned'));
      assert.ok(editor.text.includes('Ready to publish'), 'Saved media, introduction and services satisfy existing review requirements without publishing');
      const library = await http(origin, host, `/admin/media?project=${projectId}`, { headers });
      assert.equal(library.status, 200); assert.ok(library.text.includes(title));
      const publicPath = `/portfolio/${project.slug}`;
      assert.equal((await http(origin, `${id}.example.test`, publicPath)).status, 404);
      const link = await send('/previews', 'POST', { days: 1, label: 'Synthetic owner review' });
      assert.equal(link.status, 201, link.text);
      const preview = JSON.parse(link.text).preview, url = new URL(preview.url), previewPath = url.pathname + url.search;
      assert.equal(url.hostname, `${id}.example.test`);
      const own = await http(origin, `${id}.example.test`, previewPath);
      assert.equal(own.status, 200); assert.ok(own.text.includes(title)); assert.ok(own.text.includes('Private preview')); assert.match(own.text, /name="robots" content="noindex, nofollow"/);
      assert.equal((await http(origin, `${other}.example.test`, previewPath)).status, 404);
      assert.equal((await http(origin, `${other}.example.test`, route + '/media', { headers: { cookie: driver.cookie(other) } })).status, 404);
      const revoked = await send(`/previews?previewId=${encodeURIComponent(preview.id)}`, 'DELETE');
      assert.equal(revoked.status, 200);
      assert.equal((await http(origin, `${id}.example.test`, previewPath)).status, 404);
      project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
      assert.equal(project.status, 'DRAFT'); assert.equal(project.publishedAt, null);
      cases.push({ tenant: id, actualDraftAction: true, detailsSaved: true, registeredSyntheticMediaAttachedAndEdited: true, serviceSelectionSaved: true, editorReadyAndPrivateReviewLinked: true, mediaLibraryDiscovery: true, privatePreview200: true, foreignPreviewAndMedia404: true, revokedPreview404: true, remainedUnpublished: true });
    }
    return { cases, actualNextHttpAndServerAction: true, liveProviderCalls: false, hosted: false, scope: 'complete private-project HTTP workflow with synthetic Stream provisioning; browser interactions qualified separately' };
  } finally {
    await db.projectPreviewLink.deleteMany({ where: { projectId: { in: projects } } });
    await db.media.deleteMany({ where: { projectId: { in: projects } } });
    await db.projectService.deleteMany({ where: { projectId: { in: projects } } });
    await db.projectDetails.deleteMany({ where: { projectId: { in: projects } } });
    await db.project.deleteMany({ where: { id: { in: projects } } });
    await db.workspaceAsset.deleteMany({ where: { id: { in: assets } } });
    assert.equal(await db.project.count({ where: { id: { in: projects } } }), 0);
    assert.equal(await db.workspaceAsset.count({ where: { id: { in: assets } } }), 0);
  }
}
