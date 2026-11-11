import "server-only";

import { NextResponse } from "next/server";
import type { EmailCampaign, Prisma } from "@/app/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { bouncedBackSystemKey } from "@/lib/client-communications/bounce-core";
import { renderCampaignEmail, EmailDeliveryError } from "@/lib/client-communications/email";
import { findUnsupportedVariables, renderPersonalizedEmail } from "@/lib/client-communications/personalization";
import { addressIsMarketingEligible } from "@/lib/client-communications/preferences";
import { sendEmail } from "@/lib/client-communications/providers/resend";
import { DEFAULT_CAMPAIGN_TIME_ZONE, zonedLocalToUtc } from "@/lib/client-communications/scheduling";
import { testEmailSubject } from "@/lib/newsletters/presentation";
import {
  FEEDBACK_MODES, FEEDBACK_SURVEY, FEEDBACK_TEMPLATE_KEY, FeedbackError,
  assertFeedbackOrigin, feedbackAudience, feedbackEditableBody, feedbackEmailBody,
  feedbackRowVersion, feedbackUuid, isFeedbackSelection,
  type FeedbackDashboard, type FeedbackDraft, type FeedbackReminder, type FeedbackSelection,
} from "@/lib/feedback";

export type FeedbackSession = { userId: string; email: string; workspaceId: string; role: string };
type Input = Record<string, unknown>;
type Database = Prisma.TransactionClient;
const noStore = { "Cache-Control": "no-store" };

export function assertFeedbackAdmin(session: FeedbackSession | null | undefined): asserts session is FeedbackSession {
  if (!session?.workspaceId || !["OWNER", "ADMIN"].includes(session.role)) throw new FeedbackError("Owner or administrator access is required.", 403);
}
export async function feedbackAdmin(request?: Request) {
  const session = await getAdminSession();
  assertFeedbackAdmin(session);
  if (request) assertFeedbackOrigin(request);
  const original = await prisma.emailCampaign.findFirst({
    where: { id: FEEDBACK_SURVEY.originalCampaignId, createdBy: { workspaceId: session.workspaceId } }, select: { id: true },
  });
  if (!original) throw new FeedbackError("This survey is not available in this workspace.", 403);
  return session;
}
export async function feedbackInput(request: Request): Promise<Input> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new FeedbackError("Send a JSON request.");
  const text = await request.text();
  if (text.length > 80_000) throw new FeedbackError("This reminder is too long.", 413);
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new FeedbackError("The request could not be read."); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new FeedbackError("The request could not be read.");
  return input as Input;
}
export function feedbackResponse(data: object) { return NextResponse.json({ success: true, ...data }, { headers: noStore }); }
export function feedbackErrorResponse(error: unknown) {
  if (error instanceof FeedbackError) return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers: noStore });
  if (error instanceof EmailDeliveryError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.code === "EMAIL_PROVIDER_NOT_CONFIGURED" ? 503 : 502, headers: noStore });
  // Never return database diagnostics, recipient data, tokens, or provider payloads.
  console.error("Feedback request failed.", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ success: false, error: "Feedback is temporarily unavailable. Refresh before trying again." }, { status: 500, headers: noStore });
}
function textField(value: unknown, name: string, max: number, required = false) {
  if (value !== undefined && value !== null && typeof value !== "string") throw new FeedbackError(`${name} must be text.`);
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) throw new FeedbackError(`${name} must be ${max.toLocaleString()} characters or fewer.`);
  if (required && !text) throw new FeedbackError(`${name} is required.`);
  return text;
}
function idList(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1_000 || value.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)) throw new FeedbackError("Choose valid audience members.");
  return [...new Set((value as string[]).map((id) => id.trim()))].sort();
}
export function parseFeedbackDraft(input: Input): FeedbackDraft {
  const subject = textField(input.subject, "Subject", 160, true);
  const previewText = textField(input.previewText, "Preview text", 180);
  const body = textField(typeof input.body === "string" ? feedbackEditableBody(input.body) : input.body, "Message", 20_000, true);
  if (!body) throw new FeedbackError("Message is required.");
  if (/[\r\n]/.test(subject) || /[\r\n]/.test(previewText)) throw new FeedbackError("Subject and preview text must each be a single line.");
  const unsupported = findUnsupportedVariables(subject, previewText, body);
  if (unsupported.length) throw new FeedbackError(`Unsupported personalization variable: {{${unsupported[0]}}}`);
  if (!FEEDBACK_MODES.includes(input.mode as FeedbackDraft["mode"])) throw new FeedbackError("Choose a valid reminder audience.");
  const mode = input.mode as FeedbackDraft["mode"];
  return { subject, previewText, body, mode, groupIds: mode === "GROUPS" ? idList(input.groupIds) : [], clientIds: mode === "INDIVIDUALS" ? idList(input.clientIds) : [] };
}
function selectionFor(workspaceId: string, draft: FeedbackDraft): FeedbackSelection {
  return { feedbackSurveyId: FEEDBACK_SURVEY.id, workspaceId, originalCampaignId: FEEDBACK_SURVEY.originalCampaignId, groupIds: draft.groupIds, clientIds: draft.clientIds };
}
function scope(workspaceId: string): Prisma.EmailCampaignWhereInput {
  return { createdBy: { workspaceId }, AND: [
    { selection: { path: ["feedbackSurveyId"], equals: FEEDBACK_SURVEY.id } },
    { selection: { path: ["workspaceId"], equals: workspaceId } },
  ] };
}
export function serializeFeedbackReminder(campaign: EmailCampaign): FeedbackReminder {
  if (!isFeedbackSelection(campaign.selection)) throw new FeedbackError("Reminder not found.", 404);
  return {
    id: campaign.id, subject: campaign.subject, previewText: campaign.previewText || "", body: feedbackEditableBody(campaign.body),
    mode: campaign.recipientMode as FeedbackDraft["mode"], status: campaign.status,
    recipientCount: campaign.recipientCount, sentCount: campaign.sentCount, failedCount: campaign.failedCount,
    scheduledAt: campaign.scheduledAt?.toISOString() || null, scheduledTimeZone: campaign.scheduledTimeZone,
    rowVersion: campaign.rowVersion, selection: campaign.selection,
    createdAt: campaign.createdAt.toISOString(), sentAt: campaign.sentAt?.toISOString() || null,
    // The shared delivery engine may persist provider errors. Only expose a safe explanation here.
    scheduleError: campaign.scheduleError ? (campaign.scheduleError.startsWith("Delivery was interrupted")
      ? "Delivery was interrupted. Some emails may have been accepted. Automatic retry is disabled; review delivery before creating another reminder."
      : "Delivery needs attention. Review its status before scheduling another reminder.") : null,
  };
}

async function loadAudience(workspaceId: string, db: Database = prisma) {
  const [original, candidates] = await Promise.all([
    db.emailCampaign.findFirst({
      where: { id: FEEDBACK_SURVEY.originalCampaignId, createdBy: { workspaceId } },
      select: { id: true, subject: true, recipientCount: true, sentCount: true, sentAt: true, recipients: { where: { status: "SENT" }, select: { clientId: true } } },
    }),
    db.communicationClient.findMany({
      where: {
        workspaceMemberships: { some: { workspaceId } },
        emailSubscribed: true, emailStatus: "VALID", archivedAt: null, normalizedEmail: { not: "" },
        groupMemberships: { none: { group: { systemKey: bouncedBackSystemKey(workspaceId) } } },
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: { id: true, firstName: true, lastName: true, displayName: true, email: true, normalizedEmail: true, phone: true,
        groupMemberships: { where: { group: { systemManaged: false } }, select: { group: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  if (!original) throw new FeedbackError("This survey is not available in this workspace.", 403);
  const addresses = [...new Set(candidates.map((client) => client.normalizedEmail))];
  const [preferences, suppressions] = await Promise.all([
    db.marketingEmailPreference.findMany({ where: { normalizedEmail: { in: addresses }, status: { in: ["UNSUBSCRIBED", "SUPPRESSED"] } }, select: { normalizedEmail: true } }),
    db.communicationSuppression.findMany({ where: { normalizedEmail: { in: addresses }, releasedAt: null }, select: { normalizedEmail: true } }),
  ]);
  const blocked = new Set([...preferences, ...suppressions].map((item) => item.normalizedEmail));
  const originalIds = new Set(original?.recipients.map((recipient) => recipient.clientId) || []);
  const eligible = candidates.filter((client) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.normalizedEmail) &&
    client.email.trim().toLowerCase() === client.normalizedEmail && !blocked.has(client.normalizedEmail));
  const clients = eligible.map((client) => ({
    id: client.id, displayName: client.displayName, email: client.email,
    groupIds: client.groupMemberships.map(({ group }) => group.id), isOriginalRecipient: originalIds.has(client.id),
  }));
  const groupMap = new Map<string, { id: string; name: string; emails: Set<string> }>();
  for (const client of eligible) for (const { group } of client.groupMemberships) {
    const row = groupMap.get(group.id) || { ...group, emails: new Set<string>() };
    row.emails.add(client.normalizedEmail);
    groupMap.set(group.id, row);
  }
  const groups = [...groupMap.values()].map(({ id, name, emails }) => ({ id, name, count: emails.size })).sort((a, b) => a.name.localeCompare(b.name));
  return { clients, eligible, groups, originalCampaign: original ? {
    id: original.id, subject: original.subject, recipientCount: original.recipientCount, sentCount: original.sentCount,
    sentAt: original.sentAt?.toISOString() || null,
    eligibleRecipientCount: feedbackAudience(clients, { mode: "ORIGINAL", groupIds: [], clientIds: [] }).length,
  } : null };
}

export async function loadFeedbackDashboard(session: FeedbackSession): Promise<FeedbackDashboard> {
  assertFeedbackAdmin(session);
  const [audience, campaigns] = await Promise.all([
    loadAudience(session.workspaceId),
    prisma.emailCampaign.findMany({ where: scope(session.workspaceId), orderBy: { createdAt: "desc" } }),
  ]);
  return { survey: FEEDBACK_SURVEY, clients: audience.clients, groups: audience.groups, originalCampaign: audience.originalCampaign,
    reminders: campaigns.map(serializeFeedbackReminder), defaultTestEmail: session.email };
}
function validateSelection(draft: FeedbackDraft, audience: Awaited<ReturnType<typeof loadAudience>>) {
  if (draft.groupIds.some((id) => !audience.groups.some((group) => group.id === id)) ||
      draft.clientIds.some((id) => !audience.clients.some((client) => client.id === id))) {
    throw new FeedbackError("Some selected clients or groups are no longer eligible in this workspace. Refresh and review the audience.", 409);
  }
}
async function scopedReminder(id: string, session: FeedbackSession, db: Database = prisma) {
  const campaign = await db.emailCampaign.findFirst({ where: { id, ...scope(session.workspaceId) } });
  if (!campaign) throw new FeedbackError("Reminder not found.", 404);
  return campaign;
}
async function audit(session: FeedbackSession, id: string, action: string, recipients?: number) {
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: `FEEDBACK_REMINDER_${action}`,
    entityType: "EmailCampaign", entityId: id, summary: `Client feedback reminder ${action.toLowerCase().replaceAll("_", " ")}.`,
    metadata: { workspaceId: session.workspaceId, feedbackSurveyId: FEEDBACK_SURVEY.id, ...(recipients === undefined ? {} : { recipients }),
      ...(["SCHEDULE", "RESCHEDULE"].includes(action) ? { anonymousAcknowledged: true } : {}) },
  });
}
export async function createFeedbackDraft(session: FeedbackSession, input: Input) {
  assertFeedbackAdmin(session);
  const id = feedbackUuid(input.id);
  const draft = parseFeedbackDraft(input);
  const selection = selectionFor(session.workspaceId, draft);
  const data = { subject: draft.subject, previewText: draft.previewText || null, body: feedbackEmailBody(draft.body), templateKey: FEEDBACK_TEMPLATE_KEY, recipientMode: draft.mode, selection };
  const sameDraft = (row: EmailCampaign) => row.status === "DRAFT" && row.createdById === session.userId &&
    row.subject === data.subject && row.previewText === data.previewText && row.body === data.body &&
    row.recipientMode === data.recipientMode && isFeedbackSelection(row.selection) &&
    row.selection.workspaceId === selection.workspaceId && row.selection.originalCampaignId === selection.originalCampaignId &&
    JSON.stringify(row.selection.groupIds) === JSON.stringify(selection.groupIds) && JSON.stringify(row.selection.clientIds) === JSON.stringify(selection.clientIds);
  // A stable caller UUID makes a retry return the same record, never a second reminder.
  const existing = await prisma.emailCampaign.findFirst({ where: { id, ...scope(session.workspaceId) } });
  if (existing) {
    if (!sameDraft(existing)) throw new FeedbackError("This reminder already exists or has changed. Refresh before editing it.", 409);
    return serializeFeedbackReminder(existing);
  }
  validateSelection(draft, await loadAudience(session.workspaceId));
  let campaign: EmailCampaign;
  try {
    campaign = await prisma.emailCampaign.create({ data: { id, ...data, status: "DRAFT", recipientCount: 0, createdById: session.userId } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const retry = await prisma.emailCampaign.findFirst({ where: { id, ...scope(session.workspaceId) } });
      if (retry && sameDraft(retry)) return serializeFeedbackReminder(retry);
      throw new FeedbackError("This reminder already exists. Refresh before editing it.", 409);
    }
    throw error;
  }
  await audit(session, id, "DRAFT_SAVED");
  return serializeFeedbackReminder(campaign);
}

export async function changeFeedbackReminder(session: FeedbackSession, id: string, input: Input) {
  assertFeedbackAdmin(session);
  const rowVersion = feedbackRowVersion(input.rowVersion);
  const action = input.action;
  if (!["draft", "schedule", "reschedule", "pause", "cancel"].includes(String(action))) throw new FeedbackError("Choose a valid reminder action.");
  const updated = await prisma.$transaction(async (db) => {
    const current = await scopedReminder(id, session, db);
    if (current.rowVersion !== rowVersion) throw new FeedbackError("This reminder changed in another tab. Refresh and review it.", 409);
    const where = { id, ...scope(session.workspaceId), rowVersion, status: current.status };
    let data: Prisma.EmailCampaignUpdateManyMutationInput;
    let recipients: Array<{ clientId: string; email: string; displayName: string; firstNameSnapshot: string; lastNameSnapshot: string; fullNameSnapshot: string; phoneSnapshot: string | null }> | undefined;
    if (action === "draft") {
      if (current.status !== "DRAFT") throw new FeedbackError("Pause this reminder before editing it.", 409);
      const draft = parseFeedbackDraft(input);
      validateSelection(draft, await loadAudience(session.workspaceId, db));
      data = { subject: draft.subject, previewText: draft.previewText || null, body: feedbackEmailBody(draft.body), templateKey: FEEDBACK_TEMPLATE_KEY,
        recipientMode: draft.mode, selection: selectionFor(session.workspaceId, draft) };
    } else if (action === "schedule" || action === "reschedule") {
      if (current.status !== (action === "schedule" ? "DRAFT" : "SCHEDULED")) throw new FeedbackError("This reminder is no longer available for that schedule change.", 409);
      if (current.sentCount || current.processingStartedAt) throw new FeedbackError("Delivery has already started. Create a new reminder instead.", 409);
      if (input.anonymousAcknowledged !== true) throw new FeedbackError("Confirm that this anonymous survey may include clients who already responded.");
      const timeZone = textField(input.scheduledTimeZone, "Timezone", 100) || DEFAULT_CAMPAIGN_TIME_ZONE;
      let scheduledAt: Date;
      try { scheduledAt = zonedLocalToUtc(textField(input.scheduledLocal, "Delivery time", 40, true), timeZone); }
      catch (error) { throw new FeedbackError(error instanceof Error ? error.message : "Choose a valid delivery time."); }
      if (scheduledAt.getTime() <= Date.now() + 60_000) throw new FeedbackError("Choose a delivery time at least one minute in the future.");
      const selection = current.selection as unknown as FeedbackSelection;
      const draft = parseFeedbackDraft({ subject: current.subject, previewText: current.previewText, body: current.body, mode: current.recipientMode,
        groupIds: selection.groupIds, clientIds: selection.clientIds });
      const audience = await loadAudience(session.workspaceId, db);
      validateSelection(draft, audience);
      if (draft.mode === "ORIGINAL" && !audience.originalCampaign) throw new FeedbackError("The original invitation is unavailable in this workspace. Choose another audience.");
      const selected = feedbackAudience(audience.clients, draft);
      if (!selected.length) throw new FeedbackError("No eligible subscribed recipients were found for this audience.");
      if (selected.length > 1_000) throw new FeedbackError("Reminders are limited to 1,000 recipients. Choose a smaller audience.");
      if (!Number.isSafeInteger(input.expectedRecipientCount) || input.expectedRecipientCount !== selected.length) throw new FeedbackError("The eligible recipient count changed. Refresh and review the audience before scheduling.", 409);
      const ids = new Set(selected.map((client) => client.id));
      recipients = audience.eligible.filter((client) => ids.has(client.id)).map((client) => ({
        clientId: client.id, email: client.email, displayName: client.displayName,
        firstNameSnapshot: client.firstName, lastNameSnapshot: client.lastName, fullNameSnapshot: client.displayName, phoneSnapshot: client.phone,
      }));
      data = { status: "SCHEDULED", body: feedbackEmailBody(draft.body), templateKey: FEEDBACK_TEMPLATE_KEY,
        recipientCount: recipients.length, sentCount: 0, failedCount: 0, sentAt: null,
        scheduledAt, scheduledTimeZone: timeZone, scheduledById: session.userId, cancelledAt: null, scheduleError: null, processingStartedAt: null };
    } else if (action === "pause") {
      if (current.status !== "SCHEDULED" || current.sentCount || current.processingStartedAt) throw new FeedbackError("This reminder is already processing or cannot be paused.", 409);
      data = { status: "DRAFT", scheduledAt: null, scheduledTimeZone: null, scheduledById: null, cancelledAt: null,
        recipientCount: 0, sentCount: 0, failedCount: 0, scheduleError: null };
      recipients = [];
    } else {
      if (!["DRAFT", "SCHEDULED"].includes(current.status) || current.sentCount || current.processingStartedAt) throw new FeedbackError("This reminder is already processing or cannot be cancelled.", 409);
      data = { status: "CANCELLED", cancelledAt: new Date() };
    }
    // Claim before touching snapshots. Cron and other tabs use the same atomic status/version fence.
    const claimed = await db.emailCampaign.updateMany({ where, data: { ...data, rowVersion: { increment: 1 } } });
    if (claimed.count !== 1) throw new FeedbackError("This reminder changed or delivery already started. Refresh before trying again.", 409);
    if (recipients) {
      await db.campaignRecipient.deleteMany({ where: { campaignId: id } });
      if (recipients.length) await db.campaignRecipient.createMany({ data: recipients.map((recipient) => ({ ...recipient, campaignId: id })) });
    }
    return scopedReminder(id, session, db);
  }, { timeout: 15_000 });
  await audit(session, id, String(action).toUpperCase(), updated.recipientCount);
  return serializeFeedbackReminder(updated);
}

export function previewFeedback(input: Input) {
  const draft = parseFeedbackDraft(input);
  const personalized = renderPersonalizedEmail({ subject: draft.subject, previewText: draft.previewText, body: feedbackEmailBody(draft.body),
    recipient: { firstName: "Preview", lastName: "Recipient", fullName: "Preview Recipient", email: "preview@example.com", phone: "(555) 010-0193" } });
  return { subject: personalized.subject, html: renderCampaignEmail({ body: personalized.body, previewText: personalized.previewText,
    unsubscribeToken: "test-preview-disabled", templateKey: FEEDBACK_TEMPLATE_KEY }) };
}
export async function testFeedback(session: FeedbackSession, input: Input) {
  assertFeedbackAdmin(session);
  const operationId = feedbackUuid(input.operationId);
  const to = session.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new FeedbackError("Your signed-in email address is not valid.");
  if (input.testEmail !== undefined && input.testEmail !== session.email) throw new FeedbackError("Tests can only be sent to your signed-in email address.");
  if (!await addressIsMarketingEligible(to)) throw new FeedbackError("Your signed-in address is unsubscribed or suppressed. A test cannot be sent there.");
  const preview = previewFeedback(input);
  await sendEmail({ to, subject: testEmailSubject(preview.subject), html: preview.html, source: "test", operationId,
    idempotencyKey: `feedback-test:${session.userId}:${operationId}` });
  await audit(session, operationId, "TEST_SENT");
  return { testEmail: session.email, message: `Test accepted for ${session.email}.` };
}
