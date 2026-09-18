import 'server-only';
import type { Prisma } from '@/app/generated/prisma/client';
import { r2Config } from '@/lib/r2';
import { getPublicAssetUrl } from '@/lib/r2-upload';
import { verifyContentImage } from '@/lib/content-image-storage';
import { isWorkCardMediaKey, type WorkCardMediaKind } from '@/lib/work-card-media';
export function workCardAssetNamespace() {
 if (!r2Config.accountId || !r2Config.bucketName) throw new Error('INVALID_VALUE');
 return JSON.stringify([r2Config.accountId, r2Config.bucketName]);
}
/** Called inside the authorized curation transaction; never deletes provider objects. */
export async function resolveWorkCardMedia(tx: Prisma.TransactionClient, workspaceId: string, cardId: string, kind: WorkCardMediaKind,
 submitted: { key: string | null; url: string | null }, existing: { key: string | null; url: string | null }) {
 const { key, url } = submitted;
 const receipt = (verification: 'empty' | 'retained' | 'registered', assetId: string | null = null) => ({ workspaceId, cardId, kind, key, url, mediaId: key, assetId, verification });
 if (!key && !url) return receipt('empty');
 // Preserve an exact historical URL-only attachment; never introduce one.
 if (!key && url && existing.key === null && url === existing.url && !url.includes('/workspaces/')) return receipt('retained');
 if (!key || !url) throw new Error('INVALID_VALUE');
 const scoped = isWorkCardMediaKey(workspaceId, cardId, kind, key);
 const unchanged = key === existing.key && url === existing.url;
 if (!scoped && (!unchanged || !key.startsWith(`site/homepage/work-cards/${cardId}/`) || url.includes('/workspaces/'))) throw new Error('INVALID_VALUE');
 if (scoped && url !== getPublicAssetUrl(key)) throw new Error('INVALID_VALUE');
 const asset = await tx.workspaceAsset.findUnique({ where: { provider_providerNamespace_providerKey: { provider: 'R2', providerNamespace: workCardAssetNamespace(), providerKey: key } }, select: { id: true, workspaceId: true, status: true, provenance: true } });
 if (asset && (asset.workspaceId !== workspaceId || !['UPLOAD_PROVISIONED', 'READY'].includes(asset.status))) throw new Error('INVALID_VALUE');
 if (scoped) {
  const provenance = asset?.provenance as Record<string, unknown> | null;
  if (!asset || provenance?.kind !== 'WORK_CARD_UPLOAD' || provenance.cardId !== cardId || provenance.mediaKind !== kind) throw new Error('INVALID_VALUE');
  if (!unchanged) await verifyContentImage(key);
  return receipt('registered', asset.id);
 }
 return receipt('retained', asset?.id ?? null);
}
