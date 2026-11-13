/** A resend is a separate, single-recipient delivery, never another audience send. */
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invitationIdPattern = /^[a-zA-Z0-9-]{1,100}$/;
export const RESEND_COOLDOWN_MS = 10 * 60_000;
export class EventResendConflict extends Error {}
export function resendStage(invitationId: unknown, requestId: unknown) {
  if (typeof invitationId !== "string" || !invitationIdPattern.test(invitationId)) throw new Error("Choose one invited guest.");
  if (typeof requestId !== "string" || !requestIdPattern.test(requestId)) throw new Error("Create a new resend request.");
  return `RESEND_${invitationId}_${requestId.toLowerCase()}`;
}
export function resendInvitationId(stage: string): string | null {
  const match = /^RESEND_([^_]+)_(.+)$/.exec(stage);
  return match && invitationIdPattern.test(match[1]) && requestIdPattern.test(match[2]) ? match[1] : null;
}
export type ResendDelivery = { stage: string; status: string; scheduledAt: string | Date; messages?: { invitationId?: string; status?: string; sentAt?: string | Date | null }[] };
export function resendUnavailable(event: { status: string; startsAt: string | Date | null; deliveries?: ResendDelivery[] }, invitationId: string, now = Date.now()): string {
  if (event.status !== "SCHEDULED" || !event.startsAt || !(+new Date(event.startsAt) > now)) return "Resends are available only for active, upcoming events.";
  const initial = event.deliveries?.find(delivery => delivery.stage === "INITIAL");
  const original = initial?.messages?.find(message => message.invitationId === invitationId);
  if (original?.status !== "SENT") return "Wait until the original invitation is confirmed sent. Uncertain delivery needs review before resending.";
  const resends = event.deliveries?.filter(delivery => resendInvitationId(delivery.stage) === invitationId) || [];
  if (resends.some(delivery => delivery.status === "SCHEDULED" || delivery.messages?.some(message => ["PENDING", "SENDING", "UNCERTAIN"].includes(message.status || "")))) return "A resend is queued or needs delivery review. Refresh before trying again.";
  if (resends.some(delivery => delivery.status !== "CANCELLED" && (now - +new Date(delivery.scheduledAt) < RESEND_COOLDOWN_MS || delivery.messages?.some(message => message.sentAt && now - +new Date(message.sentAt) < RESEND_COOLDOWN_MS)))) return "Please wait 10 minutes, then refresh before resending this guest's invitation again.";
  return "";
}
