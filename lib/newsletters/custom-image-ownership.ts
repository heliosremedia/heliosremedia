import "server-only";
import { prisma } from "@/lib/prisma";
import { r2Config } from "@/lib/r2";
import { verifyContentImage } from "@/lib/content-image-storage";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { newsletterImageReferenceMatches, safeNewsletterImageUrl } from "./source-images";

/** Public external images remain supported; managed R2 URLs require ownership evidence. */
export async function verifyNewsletterCustomImage(input: {
  workspaceId: string; url: string; existingUrl?: string;
}) {
  if (!input.url) return;
  if (!safeNewsletterImageUrl(input.url) || !newsletterImageReferenceMatches(input.workspaceId, input.url)) {
    throw new Error("The custom image is not available to this company.");
  }
  const url = new URL(input.url);
  const base = new URL(`${r2Config.publicUrl.replace(/\/+$/, "")}/`);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  const key = decodeURIComponent(url.pathname.slice(base.pathname.length));
  if (!key || url.search || url.hash || !newsletterImageReferenceMatches(input.workspaceId, key)) {
    throw new Error("The custom image is not available to this company.");
  }
  const asset = await prisma.workspaceAsset.findUnique({
    where: { provider_providerNamespace_providerKey: {
      provider: "R2", providerNamespace: JSON.stringify([r2Config.accountId, r2Config.bucketName]), providerKey: key,
    } }, select: { workspaceId: true, status: true },
  });
  const unchanged = input.url === input.existingUrl;
  if (asset) {
    if (asset.workspaceId !== input.workspaceId || !["UPLOAD_PROVISIONED", "READY"].includes(asset.status)) {
      throw new Error("The custom image is not available to this company.");
    }
  } else if (!unchanged) {
    // Old application versions can still upload this namespace during the expansion rollout.
    const legacyPrefix = `email/newsletters/${input.workspaceId}/`;
    if (!key.startsWith(legacyPrefix) || !/^[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/.test(key.slice(legacyPrefix.length))
      || tenantContextEnabled() || process.env.STUDIO_V2_ASSET_OWNERSHIP_ENABLED?.trim().toLowerCase() === "true") {
      throw new Error("The custom image has no verified upload record.");
    }
    const companies = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (companies.length !== 1 || companies[0].id !== input.workspaceId) throw new Error("The custom image has no verified upload record.");
  }
  if (!unchanged) await verifyContentImage(key);
}
