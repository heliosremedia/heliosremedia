import "server-only";
import { renderCampaignEmail } from "@/lib/client-communications/email";
import { getSiteUrl } from "@/lib/site";
export function renderEventEmail(event: {title:string;description:string;location:string;startsAt:Date;timeZone:string}, stage: string, token?:string, unsubscribeToken = "test-preview-disabled") {
  const subject = `${stage === "REMINDER" ? "Event reminder: " : stage === "FOLLOW_UP" ? "RSVP reminder: " : "You're invited: "}${event.title}`;
  const date = new Intl.DateTimeFormat("en-US", {dateStyle:"full",timeStyle:"short",timeZone:event.timeZone}).format(event.startsAt);
  const body = `${event.title}\n\n${event.description}\n\nWhen: ${date} (${event.timeZone})\nWhere: ${event.location}\n\n${token ? "Please RSVP using the button below. You can change your response until the event starts." : "TEST / PREVIEW ONLY. RSVP is disabled; no client invitation has been created."}`;
  let html = renderCampaignEmail({body,unsubscribeToken,templateKey:"SIGNATURE"});
  if (token) {
    const url = `${getSiteUrl()}/events/rsvp#token=${encodeURIComponent(token)}`;
    html = html.replace('</div><p style="margin:26px', `<p style="margin-top:30px"><a href="${url}" style="background:#df6b2b;color:#fff;padding:14px 24px;text-decoration:none">View invitation &amp; RSVP Yes / No</a></p></div><p style="margin:26px`);
  }
  return {subject,html};
}
