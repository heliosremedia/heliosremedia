import "server-only";
import { prisma } from "@/lib/prisma";
import { r2Config } from "@/lib/r2";
import { verifyContentImage } from "@/lib/content-image-storage";
import { brandAssetPrefix, type BrandAssetKind } from "@/lib/workspace-brand-storage";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

type RegisteredBrandKind = Extract<BrandAssetKind, "testimonials" | "trusted-logos" | "photo-comparison">;

function namespace() {
  if (!r2Config.accountId || !r2Config.bucketName) throw new Error("INVALID_BRAND_IMAGE");
  return JSON.stringify([r2Config.accountId, r2Config.bucketName]);
}
function assertKey(workspaceId: string, kind: RegisteredBrandKind, key: string) {
  const prefix = brandAssetPrefix(workspaceId, kind);
  if (!key.startsWith(prefix) || !/^[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/.test(key.slice(prefix.length))) throw new Error("INVALID_BRAND_IMAGE");
}

/** Register identity before granting a signed URL or executing an object write. */
export async function withBrandUploadAsset<T>(input: {
  workspaceId: string; actorId: string; kind: RegisteredBrandKind; key: string; byteSize: number;
}, provision: () => Promise<T>): Promise<T> {
  assertKey(input.workspaceId, input.kind, input.key);
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0) throw new Error("INVALID_BRAND_IMAGE");
  const asset = await prisma.workspaceAsset.create({ data: {
    workspaceId: input.workspaceId, provider: "R2", providerNamespace: namespace(), providerKey: input.key,
    byteSize: BigInt(input.byteSize), provenance: { kind: "BRAND_UPLOAD", assetKind: input.kind, actorId: input.actorId },
  }, select: { id: true } });
  try {
    const result = await provision();
    const changed = await prisma.workspaceAsset.updateMany({
      where: { id: asset.id, workspaceId: input.workspaceId, status: "UPLOAD_PENDING" }, data: { status: "UPLOAD_PROVISIONED" },
    });
    if (changed.count !== 1) throw new Error("INVALID_BRAND_IMAGE");
    return result;
  } catch (error) {
    await prisma.workspaceAsset.updateMany({ where: { id: asset.id, workspaceId: input.workspaceId, status: "UPLOAD_PENDING" }, data: { status: "FAILED" } }).catch((failure) => {
      console.error("Unable to record failed brand upload:", failure);
    });
    throw error;
  }
}

/** Call after validating the complete submitted image against its scoped record. */
export async function verifyRegisteredBrandImage(input: {
  workspaceId: string; kind: RegisteredBrandKind; key: string | null; existingKey?: string | null;
}) {
  if (!input.key) return;
  const unchanged = input.existingKey === input.key;
  // Exact legacy references can remain on the same authorized record. A foreign
  // workspace prefix is never accepted even if that record already contains it.
  if (!unchanged || input.key.startsWith("workspaces/")) assertKey(input.workspaceId, input.kind, input.key);
  const asset = await prisma.workspaceAsset.findUnique({
    where: { provider_providerNamespace_providerKey: { provider: "R2", providerNamespace: namespace(), providerKey: input.key } },
    select: { id: true, workspaceId: true, status: true },
  });
  if (asset) {
    if (asset.workspaceId !== input.workspaceId || !["UPLOAD_PROVISIONED", "READY"].includes(asset.status)) throw new Error("INVALID_BRAND_IMAGE");
  } else if (!unchanged) {
    const enforced = tenantContextEnabled() || process.env.STUDIO_V2_ASSET_OWNERSHIP_ENABLED?.trim().toLowerCase() === "true";
    if (enforced) throw new Error("INVALID_BRAND_IMAGE");
    const companies = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (companies.length !== 1 || companies[0].id !== input.workspaceId) throw new Error("INVALID_BRAND_IMAGE");
  }
  // Preserve existing images without a provider round trip on unrelated edits.
  // A known disallowed registry status was checked above, including unchanged IDs.
  if (!unchanged) await verifyContentImage(input.key);
}
