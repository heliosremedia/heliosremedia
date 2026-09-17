/** Pure work-card identity checks shared by preparation, attachment and browser receipts. */
export type WorkCardMediaKind = 'image' | 'video';
export function workCardMediaPrefix(workspaceId: string, cardId: string) {
 if (![workspaceId, cardId].every(id => /^[a-zA-Z0-9_-]+$/.test(id))) throw new Error('INVALID_VALUE');
 return `workspaces/${workspaceId}/homepage-work-cards/${cardId}/`;
}
export function isWorkCardMediaKey(workspaceId: string, cardId: string, kind: WorkCardMediaKind, key: string) {
 const prefix = workCardMediaPrefix(workspaceId, cardId);
 return key.startsWith(prefix) && (kind === 'image' ? /^image-[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/ : /^video-[a-zA-Z0-9_-]+\.(mp4|webm)$/).test(key.slice(prefix.length));
}
export function canonicalWorkCardUrl(key: string, url: string) {
 try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname.endsWith('/' + key); } catch { return false; }
}
