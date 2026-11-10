import "server-only";
import { renderEventEmail } from "./email";
import { eventUpdateInput, type EventUpdateCopy } from "./updates-core";

/** Reuse the event's appearance/details and RSVP token without editing its three original messages. */
export function renderEventUpdate(event: Parameters<typeof renderEventEmail>[0], input: EventUpdateCopy, token?: string, unsubscribeToken?: string, context?: Parameters<typeof renderEventEmail>[4]) {
  const copy = eventUpdateInput(input);
  return renderEventEmail({...event,emailContent:{INITIAL:{subject:copy.subject,body:copy.body}}}, "INITIAL", token, unsubscribeToken, context);
}
