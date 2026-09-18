import { createHash } from 'node:crypto';
/** Includes stored generation so returning to the same order does not revive a stale tab. */
export function homepageLayoutRevision(userId: string, workspaceId: string, stored: unknown) {
 return createHash('sha256').update(JSON.stringify([userId, workspaceId, stored ?? null])).digest('hex');
}
