import { canonicalRevision, type SettingsRevision } from './site-settings-editor';

export type FilmSettings = {
  featuredFilmEnabled: boolean;
  featuredFilmVideoStorageKey: string | null;
  featuredFilmVideoUrl: string | null;
  featuredFilmPosterStorageKey: string | null;
  featuredFilmPosterUrl: string | null;
  featuredFilmDestination: string | null;
};
export type FilmKind = 'video' | 'poster';
export const filmSelect = { featuredFilmEnabled: true, featuredFilmVideoStorageKey: true, featuredFilmVideoUrl: true,
  featuredFilmPosterStorageKey: true, featuredFilmPosterUrl: true, featuredFilmDestination: true } as const;
export function filmDTO(row: FilmSettings): FilmSettings {
  return Object.fromEntries(Object.keys(filmSelect).map(key => [key, row[key as keyof FilmSettings]])) as FilmSettings;
}
export function filmPair(row: FilmSettings, kind: FilmKind) {
  return kind === 'video' ? { key: row.featuredFilmVideoStorageKey, url: row.featuredFilmVideoUrl }
    : { key: row.featuredFilmPosterStorageKey, url: row.featuredFilmPosterUrl };
}
export function sameFilmRevision(a: SettingsRevision | undefined, b: SettingsRevision) {
  return !!a && a.id === b.id && a.workspaceId === b.workspaceId && a.storedWorkspaceId === b.storedWorkspaceId && a.updatedAt === b.updatedAt;
}
export function validFilmRevision(value: unknown): value is SettingsRevision {
  if (!value || typeof value !== 'object') return false;
  const r = value as SettingsRevision;
  return typeof r.id === 'string' && !!r.id && typeof r.workspaceId === 'string' && !!r.workspaceId
    && (r.storedWorkspaceId === null || typeof r.storedWorkspaceId === 'string') && (r.updatedAt === null || canonicalRevision(r.updatedAt));
}
export function filmDestination(input: string | null) {
  const value = input?.trim() || '/portfolio?service=cinematic-films';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('INVALID_VALUE');
  return url.toString();
}
export function scopedFilmKey(key: unknown, workspaceId: string, kind: FilmKind): key is string {
  const prefix = `workspaces/${encodeURIComponent(workspaceId)}/site-featured-film/`;
  return typeof key === 'string' && key.startsWith(prefix) && (kind === 'video'
    ? /^video-[a-zA-Z0-9_-]+\.(mp4|webm)$/ : /^poster-[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/).test(key.slice(prefix.length));
}
export function canonicalFilmUrl(value: unknown, key: string): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith('/' + key); } catch { return false; }
}
// Validate only a correlated server acknowledgement. Registry truth remains server-owned.
export function acceptFilmAcknowledgement(value: unknown, requestId: string, prior: SettingsRevision, frozen: FilmSettings, before: FilmSettings): { settings: FilmSettings; revision: SettingsRevision } | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as { success?: unknown; settings?: FilmSettings; acknowledgement?: { protocol: number; requestId: string; scope: string; previousRevision: SettingsRevision; revision: SettingsRevision; media: Record<FilmKind, { key: string | null; url: string | null; workspaceId: string; kind: FilmKind; verification: string }> } };
  const ack = data.acknowledgement, row = data.settings;
  if (data.success !== true || !ack || ack.protocol !== 1 || ack.requestId !== requestId || ack.scope !== 'featured-film'
    || !sameFilmRevision(ack.previousRevision, prior) || !validFilmRevision(ack.revision) || !sameFilmRevision({ ...ack.revision, updatedAt: prior.updatedAt }, prior)
    || !canonicalRevision(ack.revision.updatedAt) || Date.parse(ack.revision.updatedAt) <= (prior.updatedAt === null ? 0 : Date.parse(prior.updatedAt))
    || !row || typeof row.featuredFilmEnabled !== 'boolean' || row.featuredFilmEnabled !== frozen.featuredFilmEnabled
    || row.featuredFilmDestination !== filmDestination(frozen.featuredFilmDestination)) return null;
  for (const kind of ['video', 'poster'] as const) {
    const pair = filmPair(row, kind), expected = filmPair(frozen, kind), retained = filmPair(before, kind), proof = ack.media?.[kind];
    if (!proof || pair.key !== expected.key || pair.url !== expected.url || proof.key !== pair.key || proof.url !== pair.url || proof.workspaceId !== prior.workspaceId || proof.kind !== kind) return null;
    if (pair.key === null && pair.url === null) { if (proof.verification !== 'empty') return null; }
    else if (pair.key === retained.key && pair.url === retained.url) {
      if (proof.verification !== 'retained' || (pair.key?.startsWith('workspaces/') && !scopedFilmKey(pair.key, prior.workspaceId, kind)) || (pair.url?.includes('/workspaces/') && !pair.url.includes(`/workspaces/${encodeURIComponent(prior.workspaceId)}/site-featured-film/`))) return null;
    } else if (!scopedFilmKey(pair.key, prior.workspaceId, kind) || !canonicalFilmUrl(pair.url, pair.key) || proof.verification !== 'registered') return null;
  }
  return { settings: filmDTO(row), revision: { ...ack.revision } };
}
