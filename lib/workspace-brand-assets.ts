import type { Prisma } from "@/app/generated/prisma/client";
import "server-only";
import { prisma } from "@/lib/prisma";
import { requireLockedWorkspaceAdministrator, requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { r2Config } from "@/lib/r2";
import { verifyContentImage } from "@/lib/content-image-storage";
import { brandAssetPrefix, type BrandAssetKind } from "@/lib/workspace-brand-storage";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

type RegisteredBrandKind = Extract<BrandAssetKind, "email-campaign" | "testimonials" | "trusted-logos" | "photo-comparison" | "site-brand" | "site-homepage" | "site-hero" | "site-featured-film" | "about" | "team" | "blog" | "newsletter" | "locations">;

// Preserve the existing endpoint role thresholds for every registered family.
const uploadAccess: Record<RegisteredBrandKind, "ADMIN" | "EDITOR"> = {
  "email-campaign": "ADMIN", testimonials: "EDITOR", "trusted-logos": "EDITOR", "photo-comparison": "EDITOR",
  "site-brand": "ADMIN", "site-homepage": "ADMIN", "site-hero": "ADMIN", "site-featured-film": "EDITOR",
  about: "EDITOR", team: "EDITOR", blog: "EDITOR", newsletter: "ADMIN", locations: "EDITOR",
};

function namespace() {
  if (!r2Config.accountId || !r2Config.bucketName) throw new Error("INVALID_BRAND_IMAGE");
  return JSON.stringify([r2Config.accountId, r2Config.bucketName]);
}
function assertKey(workspaceId: string, kind: RegisteredBrandKind, key: string) {
  const prefix = brandAssetPrefix(workspaceId, kind);
  const filename = kind === "site-hero" || kind === "site-featured-film" ? /^(?:video-[a-zA-Z0-9_-]+\.(?:mp4|webm)|poster-[a-zA-Z0-9_-]+\.(?:jpg|png|webp|avif))$/ : /^[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/;
  if (!key.startsWith(prefix) || !filename.test(key.slice(prefix.length))) throw new Error("INVALID_BRAND_IMAGE");
}

/** Register identity before granting a signed URL or executing an object write. */
export async function withBrandUploadAsset<T>(input: {
  workspaceId: string; actorId: string; sessionVersion: number; kind: RegisteredBrandKind; key: string; byteSize: number;
}, provision: () => Promise<T>): Promise<T> {
  input = { ...input };
  const access = uploadAccess[input.kind];
  if (!access) throw new Error("INVALID_BRAND_IMAGE");
  assertKey(input.workspaceId, input.kind, input.key);
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0) throw new Error("INVALID_BRAND_IMAGE");
  const asset = await prisma.$transaction(async tx => {
    const actor = { workspaceId: input.workspaceId, userId: input.actorId, sessionVersion: input.sessionVersion };
    await (access === "ADMIN" ? requireLockedWorkspaceAdministrator(tx, actor) : requireLockedWorkspaceEditor(tx, actor));
    return tx.workspaceAsset.create({ data: {
      workspaceId: input.workspaceId, provider: "R2", providerNamespace: namespace(), providerKey: input.key,
      byteSize: BigInt(input.byteSize), provenance: { kind: "BRAND_UPLOAD", assetKind: input.kind, actorId: input.actorId },
    }, select: { id: true } });
  });
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

type BrandImageInput = { workspaceId: string; kind: RegisteredBrandKind; key: string | null; existingKey?: string | null };
type BrandImageReader = Pick<Prisma.TransactionClient, "workspaceAsset" | "workspace">;

async function checkRegisteredBrandImage(input: BrandImageInput, db: BrandImageReader) {
  if (!input.key) return;
  const unchanged = input.existingKey === input.key;
  // Exact legacy references can remain on the same authorized record. A foreign
  // workspace prefix is never accepted even if that record already contains it.
  if (!unchanged || input.key.startsWith("workspaces/")) assertKey(input.workspaceId, input.kind, input.key);
  const asset = await db.workspaceAsset.findUnique({
    where: { provider_providerNamespace_providerKey: { provider: "R2", providerNamespace: namespace(), providerKey: input.key } },
    select: { id: true, workspaceId: true, status: true },
  });
  if (asset) {
    if (asset.workspaceId !== input.workspaceId || !["UPLOAD_PROVISIONED", "READY"].includes(asset.status)) throw new Error("INVALID_BRAND_IMAGE");
  } else if (!unchanged) {
    const enforced = tenantContextEnabled() || process.env.STUDIO_V2_ASSET_OWNERSHIP_ENABLED?.trim().toLowerCase() === "true";
    if (enforced) throw new Error("INVALID_BRAND_IMAGE");
    const companies = await db.workspace.findMany({ take: 2, select: { id: true } });
    if (companies.length !== 1 || companies[0].id !== input.workspaceId) throw new Error("INVALID_BRAND_IMAGE");
  }
}

/** Call after validating the complete submitted image against its scoped record. */
export async function verifyRegisteredBrandImage(input: BrandImageInput) {
  await checkRegisteredBrandImage(input, prisma);
  // Provider inspection stays outside the caller's content transaction.
  if (input.key && input.existingKey !== input.key) await verifyContentImage(input.key);
}

/** Recheck registry authority at content commit without another provider request. */
export async function lockRegisteredBrandImage(tx: Prisma.TransactionClient, input: BrandImageInput) {
  if (!input.key) return;
  const providerNamespace = namespace();
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "WorkspaceAsset" WHERE provider='R2' AND "providerNamespace"=${providerNamespace} AND "providerKey"=${input.key} FOR SHARE`;
  // Protect absence too: an unchanged legacy key must not gain a forbidden
  // registry owner/status between validation and content commit.
  if (locked.length === 0) await tx.$queryRaw`LOCK TABLE "Workspace", "WorkspaceAsset" IN SHARE MODE`;
  await checkRegisteredBrandImage(input, tx);
}
