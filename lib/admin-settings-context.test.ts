import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, URL, AbortSignal, ...globals,
    require: (id: string) => { assert.ok(id in modules, `Unexpected dependency: ${id}`); return modules[id]; } });
  return exports as T;
}

type Route = { POST(request: Request): Promise<Response> };
type Settings = { businessName: string; brandVoice: string; brandAudience: string };

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
    CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, active BOOLEAN, "sessionVersion" INT, role TEXT,
      email TEXT, "displayName" TEXT, "navigationFavorites" JSONB, "workspaceId" TEXT);
    CREATE TABLE "WorkspaceMembership" ("userId" TEXT, "workspaceId" TEXT, status TEXT, role TEXT);
    CREATE TABLE "SiteSettings" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "businessName" TEXT, "brandVoice" TEXT, "brandAudience" TEXT);
    CREATE TABLE "Service" (id TEXT PRIMARY KEY, "workspaceId" TEXT, active BOOLEAN, name TEXT, "displayOrder" INT);
    INSERT INTO "Workspace" VALUES ('a'), ('b');
    INSERT INTO "AdminUser" VALUES ('operator', true, 7, 'OWNER', 'operator@example.test', 'Operator', '[]', 'b');
    INSERT INTO "WorkspaceMembership" VALUES ('operator', 'b', 'ACTIVE', 'EDITOR');
    INSERT INTO "SiteSettings" VALUES ('default', 'a', 'Company A', 'A voice', 'A audience'), ('settings-b', 'b', 'Company B', 'B voice', 'B audience');
    INSERT INTO "Service" VALUES ('a-service', 'a', true, 'A private service', 0), ('b-service', 'b', true, 'B service', 1), ('b-inactive', 'b', false, 'B inactive', 2);
  `);
  const state = { tenant: true, signedIn: true, publicWorkspace: 'a', publicReads: 0, settingReads: 0, serviceReads: 0,
    providerCalls: [] as Record<string, unknown>[], logs: [] as unknown[], audits: [] as unknown[], apiKey: 'synthetic-key',
    providerFailure: null as Error | null, statuses: [] as number[], output: JSON.stringify({ subjectOptions: ['One', 'Two', 'Three'], previewText: 'Preview', body: 'Preserved draft', cta: 'Read more' }) };
  const prisma = {
    adminUser: { findUnique: async ({ where }: { where: { id: string } }) => (await db.query('SELECT * FROM "AdminUser" WHERE id = $1', [where.id])).rows[0] ?? null },
    workspaceMembership: { findUnique: async ({ where }: { where: { workspaceId_userId: { workspaceId: string; userId: string } } }) => {
      const { workspaceId, userId } = where.workspaceId_userId;
      return (await db.query('SELECT * FROM "WorkspaceMembership" WHERE "workspaceId" = $1 AND "userId" = $2', [workspaceId, userId])).rows[0] ?? null;
    } },
    workspace: { findMany: async () => (await db.query('SELECT id FROM "Workspace" ORDER BY id LIMIT 2')).rows },
    siteSettings: { findUnique: async ({ where }: { where: { id?: string; workspaceId?: string } }) => {
      state.settingReads++;
      return (await db.query(`SELECT * FROM "SiteSettings" WHERE ${where.id ? 'id' : '"workspaceId"'} = $1`, [where.id ?? where.workspaceId])).rows[0] ?? null;
    } },
    service: { findMany: async ({ where }: { where: { active: boolean; workspaceId?: string } }) => {
      state.serviceReads++;
      return (await db.query('SELECT name FROM "Service" WHERE active = $1 AND ($2::text IS NULL OR "workspaceId" = $2) ORDER BY "displayOrder"', [where.active, where.workspaceId ?? null])).rows;
    } },
  };
  const modules: Record<string, unknown> = {
    'server-only': {}, '@/lib/prisma': { prisma },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => state.tenant },
    '@/lib/public-workspace': { getPublicWorkspaceId: async () => { state.publicReads++; return state.publicWorkspace; } },
    '@/lib/google-business-public': { normalizeGoogleReviewDisplayMode: (value: unknown) => value },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'synthetic-cookie' }) }) },
    'next/navigation': { redirect: () => { throw new Error('LOGIN_REDIRECT'); } },
    './token': { SESSION_COOKIE: 'session', SESSION_LIFETIME_SECONDS: 100,
      // Deliberately stale claims. Actual session.ts must read current user and membership.
      verifySessionToken: () => state.signedIn ? { userId: 'operator', workspaceId: 'a', role: 'OWNER', sessionVersion: 7 } : null },
    'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    '@/lib/audit': { recordAuditEvent: async (event: unknown) => { state.audits.push(event); } },
    './config': { requireReferralStudioEnabled() {} },
  };
  const globals = { console: { error: (...args: unknown[]) => state.logs.push(args), warn: (...args: unknown[]) => state.logs.push(args) },
    process: { env: { get OPENAI_API_KEY() { return state.apiKey; }, NODE_ENV: 'test' } },
    fetch: async (_url: string, init: RequestInit) => {
      state.providerCalls.push(JSON.parse(String(init.body)));
      if (state.providerFailure) throw state.providerFailure;
      return Response.json({ output_text: state.output }, { status: state.statuses.shift() ?? 200 });
    } };
  modules['@/lib/workspace-membership-core'] = load('./workspace-membership-core.ts', modules);
  modules['@/lib/workspace-memberships'] = load('./workspace-memberships.ts', modules);
  modules['@/lib/auth/session'] = load('./auth/session.ts', modules, globals);
  modules['@/lib/workspace-settings-core'] = load('./workspace-settings-core.ts', modules);
  const settings = load<{ getSiteSettings(workspaceId?: string): Promise<Settings> }>('./site-settings.ts', modules, globals);
  modules['@/lib/site-settings'] = settings;
  modules['./permissions'] = load('./referrals/permissions.ts', modules);
  modules['@/lib/referrals/access'] = load('./referrals/access.ts', modules);
  modules['@/lib/referrals/validation'] = load('./referrals/validation.ts', modules);
  modules['@/lib/client-communications/email-format'] = { normalizeEmailTemplateKey: () => 'editorial' };
  return { db, state, modules, globals, settings,
    email: () => load<Route>('../app/api/admin/email-ai/route.ts', modules, globals),
    referrals: () => load<Route>('../app/api/admin/referrals/ai/route.ts', modules, globals) };
}

function request(body: unknown = { brief: 'Use only the supplied verified facts.', workspaceId: 'a' }, raw = false) {
  return new Request('https://company-a.example/api/admin/email-ai?workspaceId=a', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-workspace-id': 'a' }, body: raw ? String(body) : JSON.stringify(body),
  });
}

test('Email AI uses current membership workspace, not host, body, header or signed token claims', async () => {
  const f = await fixture();
  try {
    const response = await f.email().POST(request());
    assert.equal(response.status, 200);
    assert.match(String(f.state.providerCalls[0].instructions), /Company B.*B voice.*B audience/);
    assert.doesNotMatch(JSON.stringify(f.state.providerCalls), /Company A|A voice|A audience/);
    assert.equal(f.state.publicReads, 0);
    // Public callers must still use the host even with a valid Company B session.
    assert.equal((await f.settings.getSiteSettings()).businessName, 'Company A');
    assert.equal(f.state.publicReads, 1);
    f.state.tenant = false;
    assert.equal((await f.settings.getSiteSettings('b')).businessName, 'Company A', 'legacy default behavior is unchanged');
  } finally { await f.db.close(); }
});

test('Email AI denies absent, revoked, suspended, invited, viewer and invalidated sessions before settings or provider work', async () => {
  const f = await fixture();
  try {
    const route = f.email();
    f.state.signedIn = false;
    assert.equal((await route.POST(request())).status, 401);
    f.state.signedIn = true;
    for (const status of ['REVOKED', 'SUSPENDED', 'INVITED']) {
      await f.db.query('UPDATE "WorkspaceMembership" SET status = $1', [status]);
      assert.equal((await route.POST(request())).status, 401, status);
    }
    await f.db.exec(`UPDATE "WorkspaceMembership" SET status = 'ACTIVE', role = 'VIEWER'`);
    assert.equal((await route.POST(request())).status, 403, 'stale OWNER token does not authorize a current viewer');
    await f.db.exec(`UPDATE "WorkspaceMembership" SET role = 'EDITOR'; UPDATE "AdminUser" SET "sessionVersion" = 8`);
    assert.equal((await route.POST(request())).status, 401);
    await f.db.exec(`UPDATE "AdminUser" SET "sessionVersion" = 7, active = false`);
    assert.equal((await route.POST(request())).status, 401);
    assert.equal(f.state.settingReads, 0);
    assert.equal(f.state.providerCalls.length, 0);
  } finally { await f.db.close(); }
});

test('Email AI validates request shape and contains settings and provider failures without leaking context', async () => {
  const f = await fixture();
  try {
    const route = f.email();
    for (const body of [null, [], true, 'not an object']) assert.equal((await route.POST(request(body))).status, 400);
    assert.equal((await route.POST(request('{invalid', true))).status, 400);
    assert.equal((await route.POST(request({ brief: 'short' }))).status, 400);
    assert.equal(f.state.settingReads, 0);
    await f.db.exec(`DELETE FROM "SiteSettings" WHERE "workspaceId" = 'b'`);
    assert.equal((await route.POST(request())).status, 502);
    assert.equal(f.state.publicReads, 0);
    assert.equal(f.state.providerCalls.length, 0, 'missing tenant settings never invoke provider with another brand');
    await f.db.exec(`INSERT INTO "SiteSettings" VALUES ('b', 'b', 'Company B', 'B voice', 'B audience')`);
    f.state.providerFailure = new Error('PRIVATE database URL and company content');
    const failed = await route.POST(request());
    assert.equal(failed.status, 502);
    assert.doesNotMatch(await failed.text(), /PRIVATE/);
    assert.doesNotMatch(JSON.stringify(f.state.logs), /PRIVATE|Site settings are not configured/);
    f.state.providerFailure = Object.assign(new Error('PRIVATE timeout'), { name: 'TimeoutError' });
    assert.equal((await route.POST(request())).status, 504);
  } finally { await f.db.close(); }
});

test('Email AI preserves format payload, draft results and bounded provider retry semantics', async () => {
  const f = await fixture();
  try {
    const route = f.email();
    f.state.output = JSON.stringify({ formattedBody: '**Preserve** {{first_name}} and https://example.test', changes: ['Bold'] });
    f.state.statuses = [429, 200];
    const formatted = await route.POST(request({ action: 'format', body: 'Preserve {{first_name}} and https://example.test' }));
    assert.equal(formatted.status, 200);
    assert.match((await formatted.json()).formattedBody, /\{\{first_name\}\}/);
    assert.equal(f.state.providerCalls.length, 2);
    assert.equal(JSON.stringify(f.state.providerCalls[0]), JSON.stringify(f.state.providerCalls[1]));
    assert.match(String(f.state.providerCalls[0].instructions), /Company B/);
    f.state.statuses = [500, 500];
    assert.equal((await route.POST(request())).status, 502);
    assert.equal(f.state.providerCalls.length, 4);
    f.state.statuses = [401];
    assert.equal((await route.POST(request())).status, 401);
    assert.equal(f.state.providerCalls.length, 5);
    f.state.apiKey = '';
    assert.equal((await route.POST(request())).status, 503);
    assert.equal(f.state.providerCalls.length, 5);
  } finally { await f.db.close(); }
});

test('Admin shell resolves branding from authenticated workspace and stops on revoked access', async () => {
  const f = await fixture();
  try {
    const shell = Symbol('AdminShell');
    const layout = load<{ default(input: { children: string }): Promise<{ type: unknown; props: Record<string, unknown> }> }>('../app/admin/layout.tsx', {
      ...f.modules, './components/AdminShell': { default: shell },
      'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
    });
    const rendered = await layout.default({ children: 'Studio' });
    assert.equal(rendered.type, shell);
    assert.equal(rendered.props.businessName, 'Company B');
    assert.equal(rendered.props.children, 'Studio');
    assert.equal(f.state.publicReads, 0);
    await f.db.exec(`UPDATE "WorkspaceMembership" SET status = 'REVOKED'`);
    await assert.rejects(layout.default({ children: 'Studio' }), /LOGIN_REDIRECT/);
    assert.equal(f.state.settingReads, 1);
  } finally { await f.db.close(); }
});

test('Referral AI retains singleton containment and scopes allowed source selection without trusting request workspace', async () => {
  const f = await fixture();
  const generated: Array<Record<string, unknown>> = [];
  f.modules['@/lib/referrals/ai'] = { generateReferralCampaignDraft: async (input: Record<string, unknown>) => { generated.push(input); return { warnings: [] }; } };
  try {
    const route = f.referrals();
    assert.equal((await route.POST(request())).status, 403, 'tenant mode stays disabled for referrals');
    f.state.tenant = false;
    assert.equal((await route.POST(request())).status, 403, 'multiple workspaces stay disabled');
    assert.equal(f.state.settingReads, 0);
    assert.equal(f.state.serviceReads, 0);
    await f.db.exec(`DELETE FROM "Workspace" WHERE id = 'a'`);
    const response = await route.POST(request());
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(JSON.stringify(generated[0].verifiedBusiness)), { businessName: 'Company A', brandVoice: 'A voice', audience: 'A audience', services: ['B service'] });
    // Legacy settings intentionally remain the default row. Service ownership is explicit even if orphaned foreign rows survive.
    assert.equal(f.state.publicReads, 0);
    assert.match(JSON.stringify(f.state.audits), /"workspaceId":"b"/);
    assert.doesNotMatch(JSON.stringify(generated), /A private service|B inactive/);
    const before = f.state.serviceReads;
    assert.equal((await route.POST(request(null))).status, 400);
    assert.equal((await route.POST(request('{invalid', true))).status, 400);
    assert.equal((await route.POST(request({ brief: '' }))).status, 400);
    assert.equal(f.state.serviceReads, before, 'validate before selecting AI context');
    f.modules['@/lib/referrals/ai'] = { generateReferralCampaignDraft: async () => { throw new Error('PRIVATE provider payload'); } };
    const failed = await f.referrals().POST(request());
    assert.equal(failed.status, 500);
    assert.doesNotMatch(await failed.text(), /PRIVATE/);
    assert.doesNotMatch(JSON.stringify(f.state.logs), /PRIVATE/);
  } finally { await f.db.close(); }
});
