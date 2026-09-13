import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

type Element = { type: unknown; props: Record<string, unknown> };
function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, URL, Date, ...globals,
    require: (id: string) => { assert.ok(id in modules, `Unexpected dependency: ${id}`); return modules[id]; } });
  return exports as T;
}
const jsx = { jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }), jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }), Fragment: 'Fragment' };
const fonts = { Cormorant_Garamond: (options: { variable: string }) => ({ variable: options.variable }), Inter: (options: { variable: string }) => ({ variable: options.variable }) };
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}

test('shared root renders only document/font structure without public data, metadata or tracking dependencies', () => {
  const root = load<{ default(input: { children: string }): Element; generateMetadata?: unknown; viewport: unknown }>('../app/layout.tsx', {
    'next/font/google': fonts, './globals.css': {}, 'react/jsx-runtime': jsx,
    // Public settings, headers, sessions, database and scripts are intentionally unavailable.
  });
  const rendered = root.default({ children: 'Studio without a public domain' });
  assert.equal(rendered.type, 'html');
  assert.equal(rendered.props.lang, 'en');
  const body = rendered.props.children as Element;
  assert.equal(body.type, 'body');
  assert.equal(body.props.className, '--font-cormorant --font-inter');
  assert.equal(body.props.children, 'Studio without a public domain');
  assert.equal(root.generateMetadata, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(root.viewport)), { themeColor: '#0f0f10', colorScheme: 'dark' });
});

test('public layout keeps tenant metadata, revisioned images and escaped JSON-LD while binding locations to one host resolution', async () => {
  let host = 'b';
  let resolutions = 0;
  let fail = false;
  let tenant = true;
  const globals = { process: { env: { VERCEL_ENV: 'production', NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-SYNTHETIC' } } };
  const site = load('./site.ts', {}, globals);
  const seo = load('./seo.ts', { '@/lib/site': site });
  const company = (id: string) => ({ businessName: `Company ${id.toUpperCase()} </script>`, websiteUrl: `https://company-${id}.example.test`,
    faviconUrl: `https://assets.example.test/${id}/icon.png?size=32`, faviconVersion: 4, defaultSeoTitle: `Company ${id.toUpperCase()}`,
    defaultSeoDescription: `Description ${id}`, defaultSocialImageUrl: `/${id}/social.png`, defaultSocialImageVersion: 7,
    defaultSocialImageAlt: `Company ${id} image`, phoneE164: '+15555550100', email: null, heroPosterUrl: `/${id}/hero.jpg`, brandLogoUrl: `/${id}/logo.png`,
    serviceArea: `Area ${id}`, instagramUrl: `https://www.instagram.com/company-${id}`, facebookUrl: 'https://www.facebook.com/search/top?q=unsafe' });
  const provider = Symbol('SiteSettingsProvider');
  const script = Symbol('Script');
  const layout = load<{ default(input: { children: string }): Promise<Element>; generateMetadata(): Promise<Record<string, unknown>> }>('../app/(public)/layout.tsx', {
    'react/jsx-runtime': jsx, 'next/script': { default: script }, '@/lib/site': site, '@/lib/seo': seo,
    '@/app/components/SiteSettingsProvider': { SiteSettingsProvider: provider },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => tenant },
    '@/lib/public-workspace': { getPublicWorkspaceId: async () => { resolutions++; return host; } },
    '@/lib/site-settings': { getSiteSettings: async (workspaceId?: string) => { if (fail) throw new Error('Unavailable'); return company(workspaceId ?? host); } },
    '@/lib/location-pages': { getPublishedLocationPages: async (workspaceId?: string) => { assert.equal(workspaceId, tenant ? host : undefined); return [{ workspaceId, slug: `${workspaceId}-town` }]; } },
  }, globals);
  for (const id of ['a', 'b']) {
    host = id;
    const metadata = await layout.generateMetadata();
    assert.equal(String(metadata.metadataBase), `https://company-${id}.example.test/`);
    assert.equal((metadata.alternates as { canonical: string }).canonical, `https://company-${id}.example.test/`);
    assert.equal((metadata.icons as { shortcut: string }).shortcut, `https://assets.example.test/${id}/icon.png?size=32&v=4`);
    const graphMetadata = metadata.openGraph as { images: Array<{ url: string }>; siteName: string };
    assert.equal(graphMetadata.images[0].url, `https://company-${id}.example.test/${id}/social.png?v=7`);
    assert.equal(metadata.robots, undefined, 'public production metadata remains indexable');
    const rendered = elements(await layout.default({ children: 'Public content' }));
    const context = rendered.find(node => node.type === provider)!;
    assert.equal((context.props.settings as { businessName: string }).businessName, company(id).businessName);
    assert.equal((context.props.locations as Array<{ workspaceId: string }>)[0].workspaceId, id);
    assert.equal(context.props.children, 'Public content');
    const structured = rendered.find(node => node.props.id === 'helios-structured-data')!;
    const serialized = (structured.props.dangerouslySetInnerHTML as { __html: string }).__html;
    assert.doesNotMatch(serialized, /<\/script>/);
    const graph = JSON.parse(serialized)['@graph'];
    assert.equal(graph[0].name, company(id).businessName);
    assert.equal(graph[0]['@id'], `https://company-${id}.example.test/#business`);
    assert.deepEqual(graph[0].sameAs, [`https://www.instagram.com/company-${id}`]);
    assert.equal(graph[1].publisher['@id'], graph[0]['@id']);
    assert.equal(rendered.filter(node => node.type === 'html' || node.type === 'body').length, 0, 'no second root document');
    assert.equal(rendered.filter(node => node.type === script).length, 3, 'existing public scripts retained');
  }
  assert.equal(resolutions, 2, 'one authoritative workspace lookup per layout render');
  fail = true;
  await assert.rejects(layout.default({ children: 'Must not render a fallback company' }), /Unavailable/);
  fail = false; tenant = false;
  const before = resolutions;
  await layout.default({ children: 'Legacy' });
  assert.equal(resolutions, before, 'legacy defaults do not gain a host dependency');
});

test('route grouping preserves every existing public page URL without placing Studio or sign-in under public context', () => {
  const pages: string[] = [];
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name === 'page.tsx') pages.push(path.replace(/^app\/\(public\)/, '').replace(/\/page\.tsx$/, '') || '/');
    }
  }
  visit('app/(public)');
  assert.deepEqual(pages.sort(), ['/', '/about', '/blog', '/blog/[slug]', '/book', '/client-portal', '/client-portal/[slug]',
    '/client-portal/[slug]/complete-registration', '/contact', '/faq', '/films', '/google-business-integration', '/inquire',
    '/locations/[city]', '/photo-finishes', '/portfolio', '/portfolio/[slug]', '/portfolio/films', '/portfolio/gallery', '/privacy',
    '/refer/[token]', '/refer/test/[token]', '/reviews', '/services', '/services/[slug]', '/terms', '/unsubscribe'].sort());
  for (const path of ['app/admin/layout.tsx', 'app/login/page.tsx', 'app/accept-invite/page.tsx']) assert.ok(readFileSync(path, 'utf8'));
  const admin = readFileSync('app/admin/layout.tsx', 'utf8');
  assert.match(admin, /robots: \{ index: false, follow: false \}/);
  const footer = readFileSync('app/components/Footer.tsx', 'utf8');
  assert.match(footer, /<a\s+href="\/login"/);
  assert.doesNotMatch(footer, /<Link\s+href="\/login"/);
});

test('location list and detail reads isolate company ownership and never use bundled/default fallbacks in tenant mode', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE locations (id TEXT, "workspaceId" TEXT, slug TEXT, city TEXT, published BOOLEAN, "displayOrder" INT, "localDetails" JSONB);
      INSERT INTO locations VALUES ('a', 'a', 'fort-collins', 'Fort Collins', true, 0, '[]'),
        ('b', 'b', 'b-town', 'B town', true, 1, '["Local fact", 7]'), ('draft', 'b', 'draft', 'Draft', false, 0, '[]')`);
    let enabled = true;
    let host = 'b';
    let failure = false;
    let defaultReads = 0;
    let hostReads = 0;
    const select = async (where: { workspaceId?: string; slug?: string }) => {
      if (failure) throw new Error('Synthetic database unavailable');
      return (await db.query('SELECT * FROM locations WHERE published AND ($1::text IS NULL OR "workspaceId" = $1) AND ($2::text IS NULL OR slug = $2) ORDER BY "displayOrder", city', [where.workspaceId ?? null, where.slug ?? null])).rows;
    };
    const locations = load<{ getPublishedLocationPages(workspaceId?: string): Promise<Array<{ slug: string; localDetails: string[] }>>;
      getLocationPage(slug: string, workspaceId?: string): Promise<{ slug: string } | undefined> }>('./location-pages.ts', {
      'server-only': {}, '@/lib/r2-upload': { getPublicAssetUrl: () => { throw new Error('No storage request allowed'); } },
      '@/lib/workspace-context-core': { tenantContextEnabled: () => enabled },
      '@/lib/public-workspace': { getPublicWorkspaceId: async () => { hostReads++; if (host === 'unknown') throw new Error('Unknown host'); return host; } },
      '@/lib/prisma': { prisma: {
        siteSettings: { findUnique: async () => { defaultReads++; return { workspaceId: 'a' }; } },
        locationPage: { findMany: async ({ where }: { where: { workspaceId?: string } }) => select(where),
          findFirst: async ({ where }: { where: { workspaceId?: string; slug?: string } }) => (await select(where))[0] ?? null },
      } },
    }, { process: { env: { NODE_ENV: 'production' } } });
    const own = await locations.getPublishedLocationPages();
    assert.deepEqual(JSON.parse(JSON.stringify(own.map(row => row.slug))), ['b-town']);
    assert.deepEqual(JSON.parse(JSON.stringify(own[0].localDetails)), ['Local fact']);
    assert.equal((await locations.getLocationPage('b-town'))?.slug, 'b-town');
    assert.equal(await locations.getLocationPage('fort-collins'), undefined);
    assert.equal(await locations.getLocationPage('draft'), undefined);
    assert.equal(defaultReads, 0);
    const resolved = hostReads;
    await locations.getPublishedLocationPages('b');
    assert.equal(hostReads, resolved, 'trusted execution context does not re-resolve the host');
    await assert.rejects(locations.getPublishedLocationPages(''), /workspace is required/);
    host = 'unknown';
    await assert.rejects(locations.getPublishedLocationPages(), /Unknown host/);
    await assert.rejects(locations.getLocationPage('fort-collins'), /Unknown host/);
    host = 'empty';
    assert.equal((await locations.getPublishedLocationPages()).length, 0);
    failure = true;
    await assert.rejects(locations.getLocationPage('fort-collins'), /Synthetic database/);
    await assert.rejects(locations.getPublishedLocationPages(), /Synthetic database/);
    enabled = false;
    assert.ok((await locations.getPublishedLocationPages()).some(row => row.slug === 'fort-collins'), 'legacy offline fallback retained');
    assert.equal((await locations.getLocationPage('fort-collins'))?.slug, 'fort-collins');
    failure = false;
    assert.deepEqual(JSON.parse(JSON.stringify((await locations.getPublishedLocationPages()).map(row => row.slug))), ['fort-collins']);
  } finally { await db.close(); }
});
