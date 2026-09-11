import "server-only";
import { prisma } from "@/lib/prisma";
import { isCloudflareStreamUid } from "@/lib/cloudflare-stream";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

export async function beginStreamUploadAsset(input: {
  workspaceId: string; projectId: string; actorId: string;
  providerNamespace: string; byteSize: number; expiresAt: Date;
}) {
  if (!input.workspaceId || !input.providerNamespace || !Number.isSafeInteger(input.byteSize) || input.byteSize <= 0) throw new Error("INVALID_ASSET_UPLOAD");
  const project = await prisma.project.findFirst({ where: { id: input.projectId, workspaceId: input.workspaceId }, select: { id: true } });
  if (!project) throw new Error("INVALID_ASSET_UPLOAD");
  return prisma.workspaceAsset.create({
    data: {
      workspaceId: input.workspaceId, provider: "CLOUDFLARE_STREAM", providerNamespace: input.providerNamespace,
      byteSize: BigInt(input.byteSize), uploadExpiresAt: input.expiresAt,
      provenance: { kind: "PROJECT_UPLOAD", projectId: input.projectId, actorId: input.actorId },
    }, select: { id: true },
  });
}

export async function bindStreamUploadAsset(input: { assetId: string; workspaceId: string; providerNamespace: string; uid: string }) {
  if (!isCloudflareStreamUid(input.uid)) throw new Error("INVALID_STREAM_ASSET");
  const where = { id: input.assetId, workspaceId: input.workspaceId, provider: "CLOUDFLARE_STREAM" as const, providerNamespace: input.providerNamespace };
  const asset = await prisma.workspaceAsset.findFirst({ where, select: { providerKey: true, status: true } });
  if (asset?.providerKey === input.uid && asset.status === "UPLOAD_PROVISIONED") return;
  if (!asset || asset.status !== "UPLOAD_PENDING" || asset.providerKey !== null) throw new Error("INVALID_STREAM_ASSET");
  const bound = await prisma.workspaceAsset.updateMany({
    where: { ...where, status: "UPLOAD_PENDING", providerKey: null },
    data: { providerKey: input.uid, status: "UPLOAD_PROVISIONED" },
  });
  if (bound.count !== 1) throw new Error("INVALID_STREAM_ASSET");
}

export async function failStreamUploadAsset(assetId: string, workspaceId: string) {
  await prisma.workspaceAsset.updateMany({ where: { id: assetId, workspaceId, status: "UPLOAD_PENDING" }, data: { status: "FAILED" } });
}

/** A client-supplied UID is not proof. Only the server's provider response is. */
export async function resolveStreamAssetForAttachment(workspaceId: string, uid: string) {
  const providerNamespace = process.env.CLOUDFLARE_STREAM_ACCOUNT_ID?.trim();
  if (!workspaceId || !providerNamespace || !isCloudflareStreamUid(uid)) throw new Error("INVALID_STREAM_ASSET");
  const asset = await prisma.workspaceAsset.findUnique({
    where: { provider_providerNamespace_providerKey: { provider: "CLOUDFLARE_STREAM", providerNamespace, providerKey: uid } },
    select: { id: true, workspaceId: true, status: true },
  });
  if (asset) {
    if (asset.workspaceId !== workspaceId || !["UPLOAD_PROVISIONED", "READY"].includes(asset.status)) throw new Error("INVALID_STREAM_ASSET");
    return asset.id;
  }
  // Temporary support for uploads started by the old application. Never infer
  // ownership from a URL or make this fallback available to another company.
  const enforced = tenantContextEnabled() || process.env.STUDIO_V2_ASSET_OWNERSHIP_ENABLED?.trim().toLowerCase() === "true";
  if (!enforced) {
    const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length === 1 && rows[0].id === workspaceId) return null;
  }
  throw new Error("INVALID_STREAM_ASSET");
}
