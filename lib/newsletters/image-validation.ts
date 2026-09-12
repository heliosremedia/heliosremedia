import "server-only";
import { prisma } from "@/lib/prisma";
import { getBlogOwnershipScope } from "@/lib/blog-ownership";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { verifyNewsletterCustomImage } from "./custom-image-ownership";
import { verifyNewsletterSourceImageSelections } from "./source-image-validation";
import { newsletterImageReferenceMatches, safeNewsletterImageUrl } from "./source-images";

type ImageBlock = { id: string; content: {
  imageUrl: string;
  imageSelection: { mode: string; candidateId?: string; assetId?: string; assetSource?: string };
} };
type StoredBlock = { id: string; content: unknown; sources: Array<{ sourceType: string; sourceId: string | null }> };

export function storedNewsletterImageBlock(block: { id: string; content: unknown }): ImageBlock {
  const content = block.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content as Record<string, unknown> : {};
  const selection = content.imageSelection && typeof content.imageSelection === "object" && !Array.isArray(content.imageSelection)
    ? content.imageSelection as Record<string, unknown> : {};
  const mode = ["AUTO", "SOURCE", "GALLERY", "AI", "CUSTOM", "NONE"].includes(String(selection.mode))
    ? String(selection.mode) : content.imageUrl ? "CUSTOM" : "AUTO";
  const imageUrl = mode === "NONE" ? "" : safeNewsletterImageUrl(content.imageUrl);
  if (mode !== "NONE" && content.imageUrl && !imageUrl) throw new Error("Newsletter image is invalid.");
  return { id: block.id, content: { imageUrl, imageSelection: {
    mode, candidateId: typeof selection.candidateId === "string" ? selection.candidateId : undefined,
    assetId: typeof selection.assetId === "string" ? selection.assetId : undefined,
    assetSource: typeof selection.assetSource === "string" ? selection.assetSource : undefined,
  } } };
}

export async function verifyNewsletterBlockImages(workspaceId: string, blocks: ImageBlock[], persistedBlocks: StoredBlock[]) {
  for (const block of blocks) {
    if (block.content.imageSelection.mode !== "SOURCE"
      && !(block.content.imageSelection.mode === "AUTO" && block.content.imageUrl)) continue;
    const persisted = persistedBlocks.find((item) => item.id === block.id)?.content;
    const persistedCandidates = persisted && typeof persisted === "object" &&
      Array.isArray((persisted as Record<string, unknown>).imageCandidates)
      ? (persisted as Record<string, unknown>).imageCandidates as Array<Record<string, unknown>> : [];
    const selected = persistedCandidates.find((candidate) =>
      candidate.id === block.content.imageSelection.candidateId &&
      candidate.url === block.content.imageUrl
    );
    if (!selected) throw new Error("The selected source image is no longer available.");
  }
  for (const block of blocks) {
    if (block.content.imageSelection.mode !== "CUSTOM") continue;
    const persisted = persistedBlocks.find(item => item.id === block.id)?.content;
    const existingUrl = persisted && typeof persisted === "object" && "imageUrl" in persisted
      && typeof persisted.imageUrl === "string" ? persisted.imageUrl : undefined;
    await verifyNewsletterCustomImage({ workspaceId, url: block.content.imageUrl, existingUrl });
  }
  await verifyNewsletterSourceImageSelections(workspaceId, blocks
    .filter(block => block.content.imageSelection.mode === "SOURCE"
      || (block.content.imageSelection.mode === "AUTO" && Boolean(block.content.imageUrl)))
    .map(block => ({
      candidateId: block.content.imageSelection.candidateId,
      url: block.content.imageUrl,
      sources: persistedBlocks.find(item => item.id === block.id)?.sources ?? [],
    })));
  const managedSelections = blocks.filter((block) =>
    block.content.imageSelection.mode === "AI" || block.content.imageSelection.mode === "GALLERY"
  );
  const aiAssetIds = managedSelections
    .filter((block) => block.content.imageSelection.mode === "AI")
    .map((block) => block.content.imageSelection.assetId)
    .filter((value): value is string => Boolean(value));
  const aiAssets = aiAssetIds.length
    ? await prisma.newsletterImageAsset.findMany({ where: { AND: [await getBlogOwnershipScope(workspaceId)], id: { in: aiAssetIds } } })
    : [];
  const mediaAssetIds = managedSelections
    .filter((block) => block.content.imageSelection.assetSource === "PORTFOLIO")
    .map((block) => block.content.imageSelection.assetId)
    .filter((value): value is string => Boolean(value));
  const blogAssetIds = managedSelections
    .filter((block) => block.content.imageSelection.assetSource === "BLOG")
    .map((block) => block.content.imageSelection.assetId)
    .filter((value): value is string => Boolean(value));
  const [mediaAssets, blogAssets] = await Promise.all([
    mediaAssetIds.length ? prisma.media.findMany({
      where: { project: { workspaceId }, id: { in: mediaAssetIds }, visibility: "VISIBLE" },
      select: { id: true, projectId: true, storageKey: true, externalUrl: true },
    }) : [],
    blogAssetIds.length ? prisma.blogPost.findMany({
      where: { AND: [await getBlogOwnershipScope(workspaceId)], id: { in: blogAssetIds } },
      select: { id: true, featuredImageStorageKey: true, featuredImageUrl: true },
    }) : [],
  ]);
  for (const block of managedSelections) {
    const selection = block.content.imageSelection;
    if (!selection.assetId) throw new Error("The selected gallery image is invalid.");
    if (selection.mode === "AI" && selection.assetSource !== "AI") {
      throw new Error("The selected AI image is invalid.");
    }
    if (selection.mode === "GALLERY" && !["PORTFOLIO", "BLOG"].includes(selection.assetSource || "")) {
      throw new Error("The selected gallery image is invalid.");
    }
    if (selection.mode === "AI" && !aiAssets.some((asset) =>
      asset.id === selection.assetId && newsletterImageReferenceMatches(workspaceId, asset.storageKey)
      && safeNewsletterImageUrl(getPublicAssetUrl(asset.storageKey)) === block.content.imageUrl
    )) throw new Error("The selected AI image is no longer available.");
    if (selection.assetSource === "PORTFOLIO" && !mediaAssets.some((asset) => {
      if (!newsletterImageReferenceMatches(workspaceId, asset.storageKey || asset.externalUrl, asset.projectId)) return false;
      const url = safeNewsletterImageUrl(asset.storageKey ? getPublicAssetUrl(asset.storageKey) : asset.externalUrl);
      return asset.id === selection.assetId && url === block.content.imageUrl;
    })) throw new Error("The selected portfolio image is no longer available.");
    if (selection.assetSource === "BLOG" && !blogAssets.some((asset) => {
      if (!newsletterImageReferenceMatches(workspaceId, asset.featuredImageStorageKey || asset.featuredImageUrl)) return false;
      const url = safeNewsletterImageUrl(asset.featuredImageStorageKey ? getPublicAssetUrl(asset.featuredImageStorageKey) : asset.featuredImageUrl);
      return asset.id === selection.assetId && url === block.content.imageUrl;
    })) throw new Error("The selected blog image is no longer available.");
  }
}
