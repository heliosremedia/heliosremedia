import { duplicateNewsletterEdition } from "@/lib/newsletters/edition-duplication";
import { verifyNewsletterBlockImages } from "@/lib/newsletters/image-validation";
import { transitionNewsletterEdition } from "@/lib/newsletters/edition-transitions";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { resolveNewsletterWorkspace } from "@/lib/newsletters/ownership";
import { getBlogOwnershipScope } from "@/lib/blog-ownership";
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
import { EmailDeliveryError, sendTestCampaign } from "@/lib/client-communications/email";
import { contentHash, recipientSelectionFromSeries } from "@/lib/newsletters/studio";
import { resolveEligibleNewsletterRecipients } from "@/lib/newsletters/recipients";
import { NEWSLETTER_BLOCK_TYPES } from "@/lib/newsletters/types";
import { getNewsletterAnalytics } from "@/lib/newsletters/analytics";

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

function safeImageUrl(value: unknown) {
  const result = clean(value, 2_000);
  if (!result) return "";
  const url = new URL(result);
  if (url.protocol !== "https:") throw new Error("Newsletter images must use a public HTTPS URL.");
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
      const selectionInput = block.imageSelection && typeof block.imageSelection === "object"
        ? block.imageSelection as Record<string, unknown> : {};
      const imageMode = ["AUTO", "SOURCE", "GALLERY", "AI", "CUSTOM", "NONE"].includes(String(selectionInput.mode))
        ? String(selectionInput.mode) : (clean(block.imageUrl, 2_000) ? "CUSTOM" : "AUTO");
      const candidates = Array.isArray(block.imageCandidates) ? block.imageCandidates.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const candidate = value as Record<string, unknown>;
        const id = clean(candidate.id, 300);
        const url = safeImageUrl(candidate.url);
        if (!id || !url) return [];
        return [{
          id, url, thumbnailUrl: safeImageUrl(candidate.thumbnailUrl),
          altText: clean(candidate.altText, 300), label: clean(candidate.label, 200),
          role: clean(candidate.role, 80), destinationUrl: safeUrl(candidate.destinationUrl),
          isVideo: candidate.isVideo === true,
          width: Number.isInteger(candidate.width) ? Number(candidate.width) : undefined,
          height: Number.isInteger(candidate.height) ? Number(candidate.height) : undefined,
        }];
      }).slice(0, 50) : [];
      const candidateId = clean(selectionInput.candidateId, 300);
      const assetId = clean(selectionInput.assetId, 300);
      const assetSource = ["PORTFOLIO", "BLOG", "AI"].includes(String(selectionInput.assetSource))
        ? String(selectionInput.assetSource) : "";
      if (imageMode === "SOURCE" && !candidates.some((item) =>
        (item as { id?: unknown }).id === candidateId
      )) throw new Error("The selected image is not available from this block's verified source.");
      return {
        id: clean(block.id, 100),
        type,
        position,
        internalLabel: clean(block.label, 120),
        content: {
          eyebrow: clean(block.eyebrow, 100),
          heading: clean(block.heading, 240),
          body: clean(block.body, 10_000),
          imageUrl: imageMode === "NONE" ? "" : safeImageUrl(block.imageUrl),
          altText: clean(block.altText, 300),
          imageLink: safeUrl(block.imageLink),
          imageIsVideo: block.imageIsVideo === true,
          imageSelection: {
            mode: imageMode,
            ...(candidateId ? { candidateId } : {}),
            ...(assetId ? { assetId } : {}),
            ...(assetSource ? { assetSource } : {}),
            sourceLabel: clean(selectionInput.sourceLabel, 200),
            attribution: clean(selectionInput.attribution, 300),
          },
          imageCandidates: candidates,
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

async function saveEdition(editionId: string, value: unknown, actor: WorkspaceWriteActor) {
  actor = { userId: actor.userId, workspaceId: actor.workspaceId, sessionVersion: actor.sessionVersion };
  const { userId: actorId, workspaceId } = actor;
  const editor = parseEditorEdition(value);
  if (!editor.subject) throw new Error("Subject is required.");
  const current = await prisma.newsletterEdition.findUnique({
    where: { id: editionId, series: await getBlogOwnershipScope(workspaceId) },
    include: { blocks: { include: { sources: true } }, approvals: { where: { revokedAt: null } } },
  });
  if (!current || ["SENT", "PARTIALLY_SENT", "CANCELLED", "SENDING", "GENERATING", "SEND_FAILED"].includes(current.status)) {
    throw new Error("This edition can no longer be edited.");
  }
  await verifyNewsletterBlockImages(workspaceId, editor.blocks, current.blocks);
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
    await requireLockedWorkspaceAdministrator(tx, actor);
    const claimed = await tx.newsletterEdition.updateMany({
      where: { id: editionId, rowVersion: current.rowVersion, series: await getBlogOwnershipScope(workspaceId),
        status: { notIn: ["SENT", "PARTIALLY_SENT", "CANCELLED", "GENERATING", "SENDING", "SEND_FAILED"] } },
      data: { rowVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new Error("Edition changed while saving. Reopen and retry.");
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
                sourceSnapshot: { workspaceId, manuallyEntered: true },
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
      where: { id: editionId, series: await getBlogOwnershipScope(workspaceId) },
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

async function approveAndSchedule(editionId: string, actor: WorkspaceWriteActor) {
  actor = { userId: actor.userId, workspaceId: actor.workspaceId, sessionVersion: actor.sessionVersion };
  const { userId: actorId, workspaceId } = actor;
  const edition = await prisma.newsletterEdition.findUnique({
    where: { id: editionId, series: await getBlogOwnershipScope(workspaceId) },
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
  const audience = await resolveEligibleNewsletterRecipients(await resolveNewsletterWorkspace(edition.series.workspaceId), selection);
  if (!audience.eligible.length) throw new Error("No eligible recipients are currently selected.");
  const revision = edition.revisions[0];
  await prisma.$transaction(async (tx) => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const claimed = await tx.newsletterEdition.updateMany({
      where: { id: editionId, rowVersion: edition.rowVersion, status: "NEEDS_REVIEW", series: await getBlogOwnershipScope(workspaceId) },
      data: { rowVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new Error("Edition changed before approval. Review it again.");
    await tx.newsletterApproval.create({
      data: {
        editionId,
        revisionId: revision.id,
        approvedById: actorId,
        approvedSendAt: edition.intendedSendAt,
        estimatedEligibleCount: audience.eligible.length,
        estimatedExcludedCount: audience.excludedCount,
        recipientSelectionSnapshot: { ...selection, workspaceId: await resolveNewsletterWorkspace(edition.series.workspaceId) },
      },
    });
    await tx.newsletterEdition.update({
      where: { id: editionId, series: await getBlogOwnershipScope(workspaceId) },
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
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  const { editionId } = await context.params;
  const edition = await getEditionForStudio(editionId, session.workspaceId);
  if (!edition) return NextResponse.json({ success: false, error: "Edition not found." }, { status: 404 });
  return NextResponse.json({
    success: true,
    edition: await serializeEdition(edition),
    analytics: await getNewsletterAnalytics(editionId),
    defaultTestRecipient: session.email,
  });
}

export async function PATCH(request: Request, context: Context) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  try {
    const { editionId } = await context.params;
    const authorizedEdition = await getEditionForStudio(editionId, session.workspaceId);
    if (!authorizedEdition) {
      return NextResponse.json({ success: false, error: "Edition not found." }, { status: 404 });
    }
    const body = await request.json() as Record<string, unknown>;
    if (body.action !== "save") throw new Error("Unsupported edition update.");
    await saveEdition(editionId, body.edition, session);
    const edition = await getEditionForStudio(editionId, session.workspaceId);
    await recordAuditEvent({
      workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email,
      action: "NEWSLETTER_EDITION_SAVED", entityType: "NewsletterEdition", entityId: editionId,
      summary: "Saved a newsletter edition and created an immutable revision.",
    });
    return NextResponse.json({ success: true, message: "Draft saved.", edition: edition && await serializeEdition(edition) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Edition could not be saved." }, { status: error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN" ? 403 : 400 });
  }
}

export async function POST(request: Request, context: Context) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  const { editionId } = await context.params;
  try {
    const authorizedEdition = await getEditionForStudio(editionId, session.workspaceId);
    if (!authorizedEdition) {
      return NextResponse.json({ success: false, error: "Edition not found." }, { status: 404 });
    }
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 80);
    let message = "Edition updated.";
    if (["generate", "regenerate"].includes(action)) {
      const result = await generateNewsletterEdition(editionId, { kind: "ADMIN", actor: session });
      message = result.message;
    } else if (["regenerate-block", "rewrite-block", "shorten-block", "expand-block"].includes(action)) {
      const blockId = clean(body.blockId, 100);
      if (!blockId) throw new Error("Choose a content block.");
      const result = await regenerateNewsletterBlock({
        editionId,
        blockId,
        action: action as "regenerate-block" | "rewrite-block" | "shorten-block" | "expand-block",
        instruction: clean(body.instruction, 1_000),
        actor: session,
      });
      message = result.message;
    } else if (action === "approve") {
      const audience = await approveAndSchedule(editionId, session);
      message = `Approved and scheduled for ${audience.eligible.length} currently eligible recipients.`;
    } else if (action === "revoke-approval" || action === "cancel" || action === "reschedule") {
      await transitionNewsletterEdition({
        actor: session, editionId, expectedVersion: authorizedEdition.rowVersion, action,
        ...(action === "reschedule" ? { intendedSendAt: new Date(clean(body.intendedSendAt, 100)) } : {}),
      });
      message = action === "cancel" ? "Scheduled edition cancelled."
        : action === "reschedule" ? "Send date changed. Approval is required again."
          : "Approval revoked. Review is required before scheduling again.";
    } else if (action === "duplicate") {
      const duplicate = await duplicateNewsletterEdition(editionId, session);
      message = `Edition duplicated (${duplicate.id}).`;
    } else if (action === "test") {
      const recipient = clean(body.recipient, 320).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        return NextResponse.json({
          success: false,
          code: "INVALID_RECIPIENT",
          error: "Enter one valid test email address.",
        }, { status: 400 });
      }
      const isImmutableSnapshot = ["SENT", "PARTIALLY_SENT", "CANCELLED"].includes(
        authorizedEdition.status,
      );
      if (!isImmutableSnapshot) {
        try {
          await saveEdition(editionId, body.edition, session);
        } catch (error) {
          console.error("[newsletter:test] edition save failed", {
            editionId,
            error: error instanceof Error ? error.message : String(error),
          });
          return NextResponse.json({
            success: false,
            code: "NEWSLETTER_SAVE_FAILED",
            error: "Newsletter could not be saved. Your test was not sent.",
          }, { status: error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN" ? 403 : 400 });
        }
      }
      const edition = await getEditionForStudio(editionId, session.workspaceId);
      if (!edition) {
        return NextResponse.json({
          success: false,
          code: "NEWSLETTER_RENDER_FAILED",
          error: "Newsletter could not be rendered. Your test was not sent.",
        }, { status: 400 });
      }
      const serialized = await serializeEdition(edition);
      let html: string;
      try {
        html = renderNewsletterEmail({
          previewText: serialized.previewText,
          blocks: serialized.blocks.map((block) => ({
            ...block, imageAlt: block.altText, imageLink: block.imageLink, linkUrl: block.link,
          })),
          unsubscribeToken: "test-preview-disabled",
          businessName: "Helios Real Estate Media",
        });
      } catch {
        return NextResponse.json({
          success: false,
          code: "NEWSLETTER_RENDER_FAILED",
          error: "Newsletter could not be rendered. Your test was not sent.",
        }, { status: 400 });
      }
      try {
        await sendTestCampaign({
          to: recipient,
          subject: serialized.subject,
          html,
          source: "newsletter",
          operationId: editionId,
        });
      } catch (error) {
        if (error instanceof EmailDeliveryError) {
          const notConfigured = error.code === "EMAIL_PROVIDER_NOT_CONFIGURED";
          return NextResponse.json({
            success: false,
            code: error.code,
            error: error.message,
          }, { status: notConfigured ? 503 : 502 });
        }
        return NextResponse.json({
          success: false,
          code: "EMAIL_PROVIDER_REJECTED",
          error: "The test email could not be delivered. Try again or review the email provider configuration.",
        }, { status: 502 });
      }
      message = `Test newsletter sent to ${recipient}.`;
      await recordAuditEvent({
        workspaceId: session.workspaceId, actorId: session.userId,
        actorEmail: session.email,
        action: "NEWSLETTER_TEST_SENT",
        entityType: "NewsletterEdition",
        entityId: editionId,
        summary: `Newsletter test sent to ${recipient}.`,
        metadata: { recipient },
      });
      return NextResponse.json({ success: true, message, edition: serialized });
    } else if (action === "send-now") {
      if (body.confirmation !== "REPLACE_SCHEDULE_AND_SEND_NOW") {
        throw new Error("Final send confirmation is required.");
      }
      await prisma.newsletterJob.updateMany({
        where: { editionId, type: "SEND", status: "PENDING" },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      const delivery = await deliverApprovedNewsletter(editionId);
      if (delivery.status === "SEND_FAILED") {
        return NextResponse.json({
          success: false,
          code: "EMAIL_PROVIDER_REJECTED",
          error: "The email provider did not accept this newsletter. Approved content remains intact and delivery can be retried safely.",
          edition: await serializeEdition(authorizedEdition),
        }, { status: 502 });
      }
      message = delivery.status === "PARTIALLY_SENT"
        ? `Newsletter partially delivered: ${delivery.sent} accepted, ${delivery.failed} failed.`
        : `Newsletter delivery accepted for ${delivery.sent} recipients.`;
    } else {
      throw new Error("Unsupported edition action.");
    }
    await recordAuditEvent({
      workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email,
      action: `NEWSLETTER_${action.replaceAll("-", "_").toUpperCase()}`,
      entityType: "NewsletterEdition", entityId: editionId,
      summary: message,
    });
    const edition = await getEditionForStudio(editionId, session.workspaceId);
    return NextResponse.json({ success: true, message, edition: edition && await serializeEdition(edition) });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error && error.message === "NEWSLETTER_EDITION_BUSY" ? "This edition has work in progress. Retry after it finishes."
        : error instanceof Error && error.message === "NEWSLETTER_EDITION_CHANGED" ? "This edition changed or cannot be updated in its current state. Reopen it and retry."
          : error instanceof Error ? error.message : "The request could not be completed.",
    }, { status: error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN" ? 403
      : error instanceof Error && ["NEWSLETTER_EDITION_BUSY", "NEWSLETTER_EDITION_CHANGED"].includes(error.message) ? 409 : 400 });
  }
}
