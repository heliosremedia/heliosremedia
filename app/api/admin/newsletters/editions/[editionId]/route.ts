import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  forbiddenNewsletterResponse,
  getEditionForStudio,
  requireNewsletterAdministrator,
  serializeEdition,
} from "@/lib/newsletters/api";
import { deliverApprovedNewsletter } from "@/lib/newsletters/delivery";
import { renderNewsletterEmail } from "@/lib/newsletters/email-renderer";
import { generateNewsletterEdition, regenerateNewsletterBlock } from "@/lib/newsletters/generation";
import { sendTestCampaign } from "@/lib/client-communications/email";
import { contentHash, recipientSelectionFromSeries } from "@/lib/newsletters/studio";
import { resolveEligibleNewsletterRecipients } from "@/lib/newsletters/recipients";
import { NEWSLETTER_BLOCK_TYPES } from "@/lib/newsletters/types";

type Context = { params: Promise<{ editionId: string }> };

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeUrl(value: unknown) {
  const result = clean(value, 2_000);
  if (!result) return "";
  const url = new URL(result);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Links must use HTTP or HTTPS.");
  return url.toString();
}

function parseEditorEdition(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  if (blocks.length > 40) throw new Error("An edition may contain at most 40 blocks.");
  return {
    subject: clean(input.subject, 160),
    previewText: clean(input.previewText, 180),
    publishableNotes: clean(input.publishableNotes, 20_000),
    internalNotes: clean(input.internalNotes, 20_000),
    blocks: blocks.map((value, position) => {
      const block = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const type = clean(block.type, 50);
      if (!NEWSLETTER_BLOCK_TYPES.includes(type as never)) throw new Error("A content block has an invalid type.");
      return {
        id: clean(block.id, 100),
        type,
        position,
        internalLabel: clean(block.label, 120),
        content: {
          eyebrow: clean(block.eyebrow, 100),
          heading: clean(block.heading, 240),
          body: clean(block.body, 10_000),
          imageUrl: safeUrl(block.imageUrl),
          altText: clean(block.altText, 300),
          link: safeUrl(block.link),
          buttonLabel: clean(block.buttonLabel, 100),
          alignment: block.alignment === "center" ? "center" : "left",
        },
      };
    }),
  };
}

function revisionSnapshot(editor: ReturnType<typeof parseEditorEdition>) {
  return editor.blocks.map((block) => ({
    type: block.type,
    internalLabel: block.internalLabel,
    ...block.content,
    imageAlt: block.content.altText,
    linkUrl: block.content.link,
    sourceIds: [],
  }));
}

async function saveEdition(editionId: string, value: unknown, actorId: string) {
  const editor = parseEditorEdition(value);
  if (!editor.subject) throw new Error("Subject is required.");
  const current = await prisma.newsletterEdition.findUnique({
    where: { id: editionId },
    include: { blocks: { include: { sources: true } }, approvals: { where: { revokedAt: null } } },
  });
  if (!current || ["SENT", "PARTIALLY_SENT", "CANCELLED"].includes(current.status)) {
    throw new Error("This edition can no longer be edited.");
  }
  const existingIds = new Set(current.blocks.map((block) => block.id));
  const retainedIds = editor.blocks.filter((block) => existingIds.has(block.id)).map((block) => block.id);
  const snapshot = revisionSnapshot(editor).map((block, index) => ({
    ...block,
    sourceIds: current.blocks.find((item) => item.id === editor.blocks[index].id)
      ?.sources.map((source) => source.sourceId).filter(Boolean) ?? [],
  }));
  const revisionNumber = current.currentRevisionNumber + 1;
  const hash = contentHash({ subject: editor.subject, previewText: editor.previewText, blocks: snapshot });
  await prisma.$transaction(async (tx) => {
    await tx.newsletterBlock.updateMany({
      where: { editionId },
      data: { position: { increment: 1_000 } },
    });
    await tx.newsletterBlock.deleteMany({
      where: { editionId, ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}) },
    });
    for (const block of editor.blocks) {
      if (existingIds.has(block.id)) {
        await tx.newsletterBlock.update({
          where: { id: block.id },
          data: {
            type: block.type as never,
            position: block.position,
            internalLabel: block.internalLabel,
            content: block.content,
            manuallyEdited: true,
            contentVersion: { increment: 1 },
          },
        });
      } else {
        await tx.newsletterBlock.create({
          data: {
            editionId,
            type: block.type as never,
            position: block.position,
            internalLabel: block.internalLabel,
            content: block.content,
            manuallyEdited: true,
            sources: {
              create: {
                sourceType: "ADMIN_CONTENT",
                sourceTitle: "Administrator-provided newsletter content",
                sourceSnapshot: { manuallyEntered: true },
              },
            },
          },
        });
      }
    }
    const revision = await tx.newsletterRevision.create({
      data: {
        editionId,
        revisionNumber,
        subject: editor.subject,
        previewText: editor.previewText || null,
        blocksSnapshot: snapshot,
        contentHash: hash,
        changeSummary: "Administrator saved edition",
        createdById: actorId,
      },
    });
    if (current.approvals.length) {
      await tx.newsletterApproval.updateMany({
        where: { editionId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: "Edition content changed after approval." },
      });
    }
    await tx.newsletterEdition.update({
      where: { id: editionId },
      data: {
        subject: editor.subject,
        previewText: editor.previewText || null,
        contentNotes: { publishable: editor.publishableNotes },
        internalNotes: editor.internalNotes || null,
        currentRevisionNumber: revisionNumber,
        approvedRevisionId: null,
        status: "NEEDS_REVIEW",
        rowVersion: { increment: 1 },
      },
    });
    void revision;
  });
}

async function approveAndSchedule(editionId: string, actorId: string) {
  const edition = await prisma.newsletterEdition.findUnique({
    where: { id: editionId },
    include: {
      series: { include: { groups: true, recipients: true } },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      blocks: true,
    },
  });
  if (!edition || edition.status !== "NEEDS_REVIEW" || !edition.revisions[0]) {
    throw new Error("Only a reviewed draft can be approved.");
  }
  if (!edition.subject || !edition.blocks.length) throw new Error("Add a subject and content before approval.");
  const selection = recipientSelectionFromSeries(edition.series);
  const audience = await resolveEligibleNewsletterRecipients(selection);
  if (!audience.eligible.length) throw new Error("No eligible recipients are currently selected.");
  const revision = edition.revisions[0];
  await prisma.$transaction(async (tx) => {
    await tx.newsletterApproval.create({
      data: {
        editionId,
        revisionId: revision.id,
        approvedById: actorId,
        approvedSendAt: edition.intendedSendAt,
        estimatedEligibleCount: audience.eligible.length,
        estimatedExcludedCount: audience.excludedCount,
        recipientSelectionSnapshot: selection,
      },
    });
    await tx.newsletterEdition.update({
      where: { id: editionId },
      data: { approvedRevisionId: revision.id, status: "SCHEDULED", rowVersion: { increment: 1 } },
    });
    await tx.newsletterJob.createMany({
      skipDuplicates: true,
      data: [{
        editionId,
        type: "SEND",
        dueAt: edition.intendedSendAt,
        idempotencyKey: `newsletter:send:${editionId}:${edition.intendedSendAt.toISOString()}`,
      }],
    });
  });
  return audience;
}

export async function GET(_request: Request, context: Context) {
  if (!await requireNewsletterAdministrator()) return forbiddenNewsletterResponse();
  const { editionId } = await context.params;
  const edition = await getEditionForStudio(editionId);
  if (!edition) return NextResponse.json({ success: false, error: "Edition not found." }, { status: 404 });
  return NextResponse.json({ success: true, edition: await serializeEdition(edition) });
}

export async function PATCH(request: Request, context: Context) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  try {
    const { editionId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    if (body.action !== "save") throw new Error("Unsupported edition update.");
    await saveEdition(editionId, body.edition, session.userId);
    const edition = await getEditionForStudio(editionId);
    await recordAuditEvent({
      actorId: session.userId, actorEmail: session.email,
      action: "NEWSLETTER_EDITION_SAVED", entityType: "NewsletterEdition", entityId: editionId,
      summary: "Saved a newsletter edition and created an immutable revision.",
    });
    return NextResponse.json({ success: true, message: "Draft saved.", edition: edition && await serializeEdition(edition) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Edition could not be saved." }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  const { editionId } = await context.params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 80);
    let message = "Edition updated.";
    if (["generate", "regenerate"].includes(action)) {
      const result = await generateNewsletterEdition(editionId, session.userId);
      message = result.message;
    } else if (["regenerate-block", "rewrite-block", "shorten-block", "expand-block"].includes(action)) {
      const blockId = clean(body.blockId, 100);
      if (!blockId) throw new Error("Choose a content block.");
      const result = await regenerateNewsletterBlock({
        editionId,
        blockId,
        action: action as "regenerate-block" | "rewrite-block" | "shorten-block" | "expand-block",
        instruction: clean(body.instruction, 1_000),
        actorId: session.userId,
      });
      message = result.message;
    } else if (action === "approve") {
      const audience = await approveAndSchedule(editionId, session.userId);
      message = `Approved and scheduled for ${audience.eligible.length} currently eligible recipients.`;
    } else if (action === "revoke-approval") {
      await prisma.$transaction([
        prisma.newsletterApproval.updateMany({
          where: { editionId, revokedAt: null },
          data: { revokedAt: new Date(), revocationReason: "Administrator revoked approval." },
        }),
        prisma.newsletterEdition.update({
          where: { id: editionId },
          data: { status: "NEEDS_REVIEW", approvedRevisionId: null, rowVersion: { increment: 1 } },
        }),
        prisma.newsletterJob.updateMany({
          where: { editionId, type: "SEND", status: { in: ["PENDING", "CLAIMED"] } },
          data: { status: "CANCELLED", completedAt: new Date() },
        }),
      ]);
      message = "Approval revoked. Review is required before scheduling again.";
    } else if (action === "cancel") {
      const result = await prisma.newsletterEdition.updateMany({
        where: { id: editionId, status: { in: ["SCHEDULED", "NEEDS_REVIEW", "APPROVED"] } },
        data: { status: "CANCELLED", cancelledAt: new Date(), approvedRevisionId: null },
      });
      if (result.count !== 1) throw new Error("This edition cannot be cancelled.");
      await prisma.newsletterJob.updateMany({
        where: { editionId, status: { in: ["PENDING", "CLAIMED"] } },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      message = "Scheduled edition cancelled.";
    } else if (action === "reschedule") {
      const intendedSendAt = new Date(clean(body.intendedSendAt, 100));
      if (!Number.isFinite(intendedSendAt.getTime()) || intendedSendAt.getTime() <= Date.now()) {
        throw new Error("Choose a future send date.");
      }
      await prisma.$transaction([
        prisma.newsletterApproval.updateMany({
          where: { editionId, revokedAt: null },
          data: { revokedAt: new Date(), revocationReason: "The intended send schedule changed." },
        }),
        prisma.newsletterEdition.update({
          where: { id: editionId },
          data: {
            intendedSendAt,
            status: "NEEDS_REVIEW",
            approvedRevisionId: null,
            rowVersion: { increment: 1 },
          },
        }),
        prisma.newsletterJob.updateMany({
          where: { editionId, type: "SEND", status: { in: ["PENDING", "CLAIMED"] } },
          data: { status: "CANCELLED", completedAt: new Date() },
        }),
      ]);
      message = "Send date changed. Approval is required again.";
    } else if (action === "duplicate") {
      const source = await prisma.newsletterEdition.findUnique({
        where: { id: editionId }, include: { blocks: { include: { sources: true } } },
      });
      if (!source) throw new Error("Edition not found.");
      const duplicate = await prisma.newsletterEdition.create({
        data: {
          seriesId: source.seriesId,
          cycleKey: `${source.cycleKey}-copy-${Date.now()}`,
          status: "NEEDS_REVIEW",
          subject: source.subject ? `${source.subject} (Copy)` : null,
          previewText: source.previewText,
          contentNotes: source.contentNotes ?? undefined,
          internalNotes: source.internalNotes,
          intendedSendAt: new Date(Math.max(Date.now() + 86_400_000, source.intendedSendAt.getTime())),
          createdById: session.userId,
          blocks: {
            create: source.blocks.map((block) => ({
              type: block.type, position: block.position, internalLabel: block.internalLabel,
              content: JSON.parse(JSON.stringify(block.content)), aiGenerated: block.aiGenerated, manuallyEdited: true,
              sources: { create: block.sources.map((item) => ({
                sourceType: item.sourceType, sourceId: item.sourceId, sourceTitle: item.sourceTitle,
                sourceUrl: item.sourceUrl,
                sourceSnapshot: item.sourceSnapshot == null
                  ? undefined : JSON.parse(JSON.stringify(item.sourceSnapshot)),
              })) },
            })),
          },
        },
      });
      message = `Edition duplicated (${duplicate.id}).`;
    } else if (action === "test") {
      const edition = await getEditionForStudio(editionId);
      if (!edition) throw new Error("Edition not found.");
      const serialized = await serializeEdition(edition);
      await sendTestCampaign({
        to: session.email,
        subject: `[TEST] ${serialized.subject}`,
        html: renderNewsletterEmail({
          previewText: serialized.previewText,
          blocks: serialized.blocks.map((block) => ({
            ...block, imageAlt: block.altText, linkUrl: block.link,
          })),
          clientId: "newsletter-test-preview",
          businessName: "Helios Real Estate Media",
        }),
      });
      message = `Test sent to ${session.email}.`;
    } else if (action === "send-now") {
      await deliverApprovedNewsletter(editionId);
      message = "Newsletter delivery completed.";
    } else {
      throw new Error("Unsupported edition action.");
    }
    await recordAuditEvent({
      actorId: session.userId, actorEmail: session.email,
      action: `NEWSLETTER_${action.replaceAll("-", "_").toUpperCase()}`,
      entityType: "NewsletterEdition", entityId: editionId,
      summary: message,
    });
    const edition = await getEditionForStudio(editionId);
    return NextResponse.json({ success: true, message, edition: edition && await serializeEdition(edition) });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "The request could not be completed.",
    }, { status: 400 });
  }
}
