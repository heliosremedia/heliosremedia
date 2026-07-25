import "server-only";

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { generateNewsletterDraft } from "./ai";
import { collectVerifiedNewsletterSources } from "./content-sources";
import { contentHash } from "./studio";

function notes(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export async function generateNewsletterEdition(editionId: string, actorId?: string) {
  const claimed = await prisma.newsletterEdition.updateMany({
    where: {
      id: editionId,
      status: { in: ["AWAITING_GENERATION", "NEEDS_REVIEW", "GENERATION_FAILED", "DRAFT_GENERATED"] },
    },
    data: { status: "GENERATING", rowVersion: { increment: 1 } },
  });
  if (claimed.count !== 1) throw new Error("This edition is not available for generation.");

  const edition = await prisma.newsletterEdition.findUnique({
    where: { id: editionId },
    include: { series: true, generationRuns: { select: { attempt: true }, orderBy: { attempt: "desc" }, take: 1 } },
  });
  if (!edition) throw new Error("Edition was not found.");
  const attempt = (edition.generationRuns[0]?.attempt ?? 0) + 1;
  const run = await prisma.newsletterGenerationRun.create({
    data: {
      editionId,
      status: "RUNNING",
      promptVersion: "newsletter-v1.5.0",
      instructionsSnapshot: { seriesId: edition.seriesId, contentNotes: edition.contentNotes },
      sourceManifest: [],
      attempt,
      startedAt: new Date(),
    },
  });

  try {
    const [posts, projects, services, settings] = await Promise.all([
      prisma.blogPost.findMany({
        where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
        orderBy: { publishedAt: "desc" }, take: 5, select: { id: true },
      }),
      prisma.project.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" }, take: 5, select: { id: true },
      }),
      prisma.service.findMany({
        where: { active: true }, orderBy: { displayOrder: "asc" }, take: 8, select: { id: true },
      }),
      getSiteSettings(),
    ]);
    const sources = await collectVerifiedNewsletterSources({
      blogPostIds: posts.map((item) => item.id),
      projectIds: projects.map((item) => item.id),
      serviceIds: services.map((item) => item.id),
      includeWebsiteContent: true,
    });
    const contentNotes = notes(edition.contentNotes);
    const draft = await generateNewsletterDraft({
      brand: {
        businessName: settings.businessName,
        voice: settings.brandVoice || "refined, intentional, cinematic, knowledgeable, and human",
        audience: settings.brandAudience || "Helios real estate media clients",
        writingGuidance: settings.brandWritingGuidance || "Avoid hype, clichés, and unsupported claims.",
      },
      goals: edition.series.goals ?? "",
      contentNotes: typeof contentNotes.publishable === "string" ? contentNotes.publishable : "",
      internalNotes: edition.internalNotes ?? "",
      approvedCallToAction: edition.series.defaultCallToAction
        ? JSON.stringify(edition.series.defaultCallToAction) : "",
      sources,
    });
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const nextRevision = edition.currentRevisionNumber + 1;
    const blockSnapshot = draft.blocks.map((block, position) => ({ ...block, position }));
    const hash = contentHash({ subject: draft.subject, previewText: draft.previewText, blocks: blockSnapshot });

    await prisma.$transaction(async (tx) => {
      await tx.newsletterBlock.deleteMany({ where: { editionId } });
      for (const [position, block] of draft.blocks.entries()) {
        await tx.newsletterBlock.create({
          data: {
            editionId,
            type: block.type as never,
            position,
            internalLabel: block.internalLabel,
            aiGenerated: true,
            content: {
              eyebrow: block.eyebrow,
              heading: block.heading,
              body: block.body,
              imageUrl: block.imageUrl,
              altText: block.altText,
              link: block.link,
              buttonLabel: block.buttonLabel,
              alignment: "left",
            },
            sources: {
              create: block.sourceIds.map((sourceId) => {
                const source = sourceById.get(sourceId);
                if (!source) throw new Error("Generated draft cited an unavailable source.");
                return {
                  sourceType: source.kind,
                  sourceId,
                  sourceTitle: source.label,
                  sourceUrl: source.url,
                  sourceSnapshot: { excerpt: source.excerpt },
                };
              }),
            },
          },
        });
      }
      await tx.newsletterRevision.create({
        data: {
          editionId,
          revisionNumber: nextRevision,
          subject: draft.subject,
          previewText: draft.previewText,
          blocksSnapshot: blockSnapshot,
          contentHash: hash,
          changeSummary: attempt === 1 ? "AI draft generated" : "AI draft regenerated",
          createdById: actorId,
        },
      });
      await tx.newsletterEdition.update({
        where: { id: editionId },
        data: {
          subject: draft.subject,
          subjectAlternatives: draft.subjectAlternatives,
          previewText: draft.previewText,
          warnings: draft.warnings,
          currentRevisionNumber: nextRevision,
          status: "NEEDS_REVIEW",
          approvedRevisionId: null,
          rowVersion: { increment: 1 },
        },
      });
      await tx.newsletterGenerationRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          model: process.env.OPENAI_NEWSLETTER_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini",
          sourceManifest: sources.map((source) => ({ id: source.id, kind: source.kind, label: source.label })),
          outputSnapshot: { subject: draft.subject, blockCount: draft.blocks.length, warnings: draft.warnings },
          completedAt: new Date(),
        },
      });
    });
    return { message: "Newsletter draft is ready for review." };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Newsletter generation failed.";
    await prisma.$transaction([
      prisma.newsletterGenerationRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errorCode: "GENERATION_FAILED", errorMessage: message, completedAt: new Date() },
      }),
      prisma.newsletterEdition.update({
        where: { id: editionId },
        data: { status: "GENERATION_FAILED", warnings: [message], rowVersion: { increment: 1 } },
      }),
    ]);
    throw new Error(message);
  }
}

export async function regenerateNewsletterBlock(input: {
  editionId: string;
  blockId: string;
  action: "regenerate-block" | "rewrite-block" | "shorten-block" | "expand-block";
  instruction?: string;
  actorId?: string;
}) {
  const block = await prisma.newsletterBlock.findFirst({
    where: { id: input.blockId, editionId: input.editionId },
    include: {
      sources: true,
      edition: {
        include: {
          series: true,
          blocks: { orderBy: { position: "asc" }, include: { sources: true } },
        },
      },
    },
  });
  if (!block) throw new Error("Newsletter block was not found.");
  if (["SENT", "PARTIALLY_SENT", "CANCELLED"].includes(block.edition.status)) {
    throw new Error("This edition can no longer be edited.");
  }
  const sources = block.sources.map((source) => {
    const snapshot = source.sourceSnapshot && typeof source.sourceSnapshot === "object"
      ? source.sourceSnapshot as Record<string, unknown> : {};
    return {
      id: source.sourceId || `block-source:${source.id}`,
      kind: source.sourceType,
      label: source.sourceTitle,
      excerpt: typeof snapshot.excerpt === "string"
        ? snapshot.excerpt
        : JSON.stringify(snapshot).slice(0, 4_000),
      url: source.sourceUrl,
    };
  });
  if (!sources.length) throw new Error("Attach verified source material before using block AI.");
  const settings = await getSiteSettings();
  const actionGuidance = {
    "regenerate-block": "Rewrite this one block while preserving all verified facts and links.",
    "rewrite-block": `Adjust this one block as directed: ${input.instruction || "refine the tone"}.`,
    "shorten-block": "Shorten this one block by about 30 percent without dropping verified facts.",
    "expand-block": "Expand this one block with useful framing, using only the supplied verified facts.",
  }[input.action];
  const current = block.content && typeof block.content === "object"
    ? block.content as Record<string, unknown> : {};
  const draft = await generateNewsletterDraft({
    brand: {
      businessName: settings.businessName,
      voice: settings.brandVoice || "refined, intentional, cinematic, knowledgeable, and human",
      audience: settings.brandAudience || "Helios real estate media clients",
      writingGuidance: settings.brandWritingGuidance || "Avoid hype, clichés, and unsupported claims.",
    },
    goals: `${actionGuidance} Return exactly one ${block.type} block.`,
    contentNotes: JSON.stringify({
      currentBlock: current,
      internalLabel: block.internalLabel,
      requiredBlockType: block.type,
    }),
    internalNotes: "Do not add a second block or introduce new facts.",
    approvedCallToAction: "",
    sources,
  });
  const replacement = draft.blocks.find((item) => item.type === block.type) ?? draft.blocks[0];
  if (!replacement) throw new Error("AI did not return a valid replacement block.");
  const content = {
    eyebrow: replacement.eyebrow,
    heading: replacement.heading,
    body: replacement.body,
    imageUrl: replacement.imageUrl,
    altText: replacement.altText,
    link: replacement.link,
    buttonLabel: replacement.buttonLabel,
    alignment: replacement.alignment === "CENTER" ? "center" : "left",
  };
  await prisma.newsletterBlock.update({
    where: { id: block.id },
    data: {
      internalLabel: replacement.internalLabel || block.internalLabel,
      content,
      aiGenerated: true,
      manuallyEdited: false,
      contentVersion: { increment: 1 },
    },
  });
  const updatedBlocks = block.edition.blocks.map((item) => {
    const itemContent = item.id === block.id
      ? content
      : item.content && typeof item.content === "object" ? item.content as Record<string, unknown> : {};
    return {
      type: item.type,
      internalLabel: item.id === block.id ? replacement.internalLabel || item.internalLabel : item.internalLabel,
      ...itemContent,
      sourceIds: item.sources.map((source) => source.sourceId).filter(Boolean),
    };
  });
  const revisionNumber = block.edition.currentRevisionNumber + 1;
  const hash = contentHash({
    subject: block.edition.subject,
    previewText: block.edition.previewText,
    blocks: updatedBlocks,
  });
  await prisma.$transaction([
    prisma.newsletterRevision.create({
      data: {
        editionId: input.editionId,
        revisionNumber,
        subject: block.edition.subject || "Untitled newsletter",
        previewText: block.edition.previewText,
        blocksSnapshot: updatedBlocks,
        contentHash: hash,
        changeSummary: `AI ${input.action}`,
        createdById: input.actorId,
      },
    }),
    prisma.newsletterApproval.updateMany({
      where: { editionId: input.editionId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: "A content block changed after approval." },
    }),
    prisma.newsletterEdition.update({
      where: { id: input.editionId },
      data: {
        status: "NEEDS_REVIEW",
        approvedRevisionId: null,
        currentRevisionNumber: revisionNumber,
        warnings: draft.warnings,
        rowVersion: { increment: 1 },
      },
    }),
  ]);
  return { message: "Selected block refreshed from its verified sources." };
}
