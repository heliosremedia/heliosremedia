import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getBlogOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { resolveNewsletterWorkspace } from "./ownership";
import { storedNewsletterImageBlock, verifyNewsletterBlockImages } from "./image-validation";
import { refreshNewsletterBlockSources } from "./block-source-context";

export async function duplicateNewsletterEdition(editionId: string, actor: WorkspaceWriteActor) {
  actor = { ...actor };
  const { workspaceId } = actor;
  await prisma.$transaction(tx => requireLockedWorkspaceAdministrator(tx, actor));
  const source = await prisma.newsletterEdition.findUnique({
    where: { id: editionId, series: await getBlogOwnershipScope(workspaceId) },
    include: { blocks: { orderBy: { position: "asc" }, include: { sources: true } } },
  });
  if (!source) throw new Error("Edition not found.");
  const images = source.blocks.map(storedNewsletterImageBlock);
  await verifyNewsletterBlockImages(workspaceId, images, source.blocks);
  const blocks: Prisma.NewsletterBlockCreateWithoutEditionInput[] = [];
  for (const [index, block] of source.blocks.entries()) {
    for (const reference of block.sources) {
      const snapshot = reference.sourceSnapshot && typeof reference.sourceSnapshot === "object"
        ? reference.sourceSnapshot as Record<string, unknown> : {};
      if (snapshot.workspaceId !== workspaceId
        && (snapshot.workspaceId !== undefined || await resolveNewsletterWorkspace(null) !== workspaceId)) {
        throw new Error("Newsletter source ownership must be verified before duplication.");
      }
    }
    const content = block.content && typeof block.content === "object" && !Array.isArray(block.content)
      ? block.content as Record<string, unknown> : {};
    const references = await refreshNewsletterBlockSources(workspaceId, block.sources, content);
    blocks.push({
      type: block.type, position: block.position, internalLabel: block.internalLabel,
      content: JSON.parse(JSON.stringify({
        ...content, imageUrl: images[index].content.imageUrl,
        imageSelection: { ...(content.imageSelection && typeof content.imageSelection === "object" ? content.imageSelection : {}), ...images[index].content.imageSelection },
        imageCandidates: references.flatMap(reference => reference.imageCandidates ?? []),
      })),
      aiGenerated: block.aiGenerated, manuallyEdited: true,
      sources: { create: references.length ? block.sources.map((reference, sourceIndex) => ({
        sourceType: reference.sourceType, sourceId: reference.sourceId,
        sourceTitle: references[sourceIndex].label, sourceUrl: references[sourceIndex].url ?? null,
        sourceSnapshot: { workspaceId, excerpt: references[sourceIndex].excerpt, imageCandidates: references[sourceIndex].imageCandidates ?? [] },
      })) : [{
        sourceType: "ADMIN_CONTENT", sourceId: null, sourceTitle: "Duplicated newsletter content", sourceUrl: null,
        sourceSnapshot: { workspaceId, manuallyEntered: true, duplicatedFromEditionId: editionId },
      }] },
    });
  }
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const scope = await getBlogOwnershipScope(workspaceId);
    const legacyAllowed = "OR" in scope;
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT edition.id FROM "NewsletterEdition" edition JOIN "NewsletterSeries" series ON series.id = edition."seriesId"
      WHERE edition.id = ${editionId} AND edition."rowVersion" = ${source.rowVersion}
        AND (series."workspaceId" = ${workspaceId} OR (series."workspaceId" IS NULL AND ${legacyAllowed}))
      FOR UPDATE OF edition
    `;
    if (!rows.length) throw new Error("NEWSLETTER_EDITION_CHANGED");
    return tx.newsletterEdition.create({
      data: {
        seriesId: source.seriesId, cycleKey: `${source.cycleKey}-copy-${randomUUID()}`, status: "NEEDS_REVIEW",
        subject: source.subject ? `${source.subject} (Copy)` : null,
        previewText: source.previewText, contentNotes: source.contentNotes ?? undefined, internalNotes: source.internalNotes,
        intendedSendAt: new Date(Math.max(Date.now() + 86_400_000, source.intendedSendAt.getTime())),
        createdById: actor.userId, blocks: { create: blocks },
      },
    });
  });
}
