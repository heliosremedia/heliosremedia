// Imported only into the disposable rehearsal copy of the Social AI route.
// No network fallback: all accepted inputs return synthetic responses.
import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';

export async function syntheticSocialFetch(url: string, options: RequestInit) {
  assert.equal(url, 'https://api.openai.com/v1/responses');
  assert.equal(options.method, 'POST');
  assert.equal(new Headers(options.headers).get('authorization'), 'Bearer packet34-synthetic-no-provider');
  assert.equal(typeof options.body, 'string');
  const body = JSON.parse(options.body as string);
  const generation = body.text.format.type === 'json_object';
  assert.ok(generation || body.text.format.type === 'json_schema');
  const id = generation ? /Social Studio for Synthetic ([ab])\./.exec(body.instructions)?.[1] : /AI_DRAFT_([ab])/.exec(body.input)?.[1];
  assert.ok(id === 'a' || id === 'b', 'Only synthetic tenants are supported');
  const other = id === 'a' ? 'b' : 'a';
  assert.ok(body.input.includes(`AI_FACT_${id}`), 'Owned source facts required');
  assert.ok(!JSON.stringify(body).includes(`AI_FACT_${other}`), 'Foreign facts forbidden');
  const platforms: string[] = generation
    ? (/Create distinct social drafts for: ([A-Z, ]+)\./.exec(body.input)?.[1].split(', ') || [])
    : body.text.format.schema?.properties?.platforms?.required;
  assert.ok(Array.isArray(platforms) && platforms.length > 0 && platforms.length <= 2);
  assert.equal(new Set(platforms).size, platforms.length);
  assert.ok(platforms.every(platform => ['FACEBOOK', 'INSTAGRAM'].includes(platform)));
  // Tests can hold this lock to stop a provider response after admission commits.
  // Return an integer column, never the PostgreSQL void-valued lock itself.
  if (generation) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(3400, ${id === 'a' ? 1 : 2}::integer)`;
  }, { timeout: 15000 });
  const mode = /PACKET36_([a-z-]+)/.exec(body.input)?.[1];
  const failureModes = ['gen-http', 'gen-json', 'gen-timeout', 'ground-http', 'ground-json', 'ground-empty', 'ground-type', 'ground-platform', 'ground-brief', 'ground-extra', 'ground-claims'];
  assert.ok(!mode || failureModes.includes(mode), 'Unknown synthetic failure mode');
  const activeFailure = mode?.startsWith(generation ? 'gen-' : 'ground-');
  if (activeFailure && mode?.endsWith('-http')) return new Response('provider-private-detail', { status: 503 });
  if (activeFailure && mode?.endsWith('-json')) return Response.json({ output_text: 'provider-private-detail' });
  if (activeFailure && mode === 'gen-timeout') throw new DOMException('provider-private-detail', 'TimeoutError');
  const campaignBrief = { positioning: `AI_DRAFT_${id}`, themes: ['Photography'], cadence: 'Weekly', formats: ['Post'], platformConsiderations: 'Clear', callsToAction: 'Explore' };
  const draft = { caption: `AI_DRAFT_${id}`, openingHook: '', hashtags: [], callToAction: '', onScreenText: '', videoConcept: '', altText: '' };
  const drafts = Object.fromEntries(platforms.map(platform => [platform, draft]));
  const review: Record<string, unknown> = { campaignBrief, platforms: drafts, unsupportedClaims: [] };
  if (!generation) {
    if (mode === 'ground-empty') review.platforms = { ...drafts, [platforms[0]]: {} };
    if (mode === 'ground-type') review.platforms = { ...drafts, [platforms[0]]: { ...draft, caption: { value: 'provider-private-detail' } } };
    if (mode === 'ground-platform') review.platforms = {};
    if (mode === 'ground-brief') review.campaignBrief = { ...campaignBrief, themes: [42] };
    if (mode === 'ground-extra') review.unexpected = 'provider-private-detail';
    if (mode === 'ground-claims') review.unsupportedClaims = [42];
  }
  return Response.json({ output_text: JSON.stringify(generation ? { campaignBrief, ...drafts } : review) });
}
