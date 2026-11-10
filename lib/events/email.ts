import "server-only";
import { renderCampaignEmail } from "@/lib/client-communications/email";
import { getSiteUrl } from "@/lib/site";
import { getEventTheme, getEventEmailCopy, safeEventImageUrl, safeEventVenueUrl } from "./themes";

type EventEmailInput = {
  title: string; description: string; location: string; startsAt: Date; timeZone: string;
  templateKey?: string | null; imageUrl?: string | null; imageAlt?: string | null;
  venueUrl?: string | null; emailContent?: unknown;
};
function escape(value: string) {
  return value.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]!);
}
function textBody(value: string, color: string) {
  return value.split(/\n\s*\n/).map(paragraph => `<p style="margin:0 0 20px;color:${color};font-size:16px;line-height:1.7;overflow-wrap:anywhere">${escape(paragraph).replace(/\n/g,"<br>")}</p>`).join("");
}
export function renderEventEmail(event: EventEmailInput, stage: string, token?: string, unsubscribeToken = "test-preview-disabled") {
  const theme = getEventTheme(event.templateKey);
  const { subject, body } = getEventEmailCopy(event, stage);
  const date = new Intl.DateTimeFormat("en-US", {dateStyle:"full",timeStyle:"short",timeZone:event.timeZone}).format(event.startsAt);
  const imageUrl = safeEventImageUrl(event.imageUrl, [process.env.R2_PUBLIC_URL]);
  const venueUrl = safeEventVenueUrl(event.venueUrl);
  const details = `When: ${date} (${event.timeZone})\nWhere: ${event.location}`;
  const instructions = token ? "Please choose Yes, No, or Maybe below, then confirm your response on the invitation page. You can change it until the event starts." : "TEST / PREVIEW ONLY. The RSVP choices below are disabled; no client invitation has been created.";
  const choices = ([ ["YES", "Yes, I'll be there"], ["NO", "No, I can't make it"], ["MAYBE", "Maybe"] ] as const).map(([response,label]) => {
    const style = `display:inline-block;margin:6px 8px 6px 0;padding:13px 18px;border:1px solid ${theme.accent};border-radius:4px;background:${response === "YES" ? theme.accent : theme.surface};color:${response === "YES" ? theme.buttonText : theme.heading};font-size:15px;font-weight:bold;line-height:1.4;text-decoration:none;`;
    if (!token) return `<span aria-disabled="true" style="${style}opacity:.6">${escape(label)}</span>`;
    const url = `${getSiteUrl()}/events/rsvp#token=${encodeURIComponent(token)}&response=${response}`;
    return `<a href="${escape(url)}" style="${style}">${escape(label)}</a>`;
  }).join("");
  const rsvp = `<div style="margin-top:26px"><p style="color:${theme.heading};font-weight:bold;font-size:18px;margin:0 0 10px">Will you join us?</p>${choices}</div>`;
  const venue = venueUrl ? `<p style="margin:18px 0;font-size:16px"><a href="${escape(venueUrl)}" style="color:${theme.heading};text-decoration:underline">View venue website</a></p>` : "";
  if (theme.key === "CLASSIC") {
    let html = renderCampaignEmail({body:`${body}\n\n${details}\n\n${instructions}`,unsubscribeToken,templateKey:"SIGNATURE",imageUrl,imageAlt:imageUrl ? event.imageAlt || event.title : null});
    html = html.replace('</div><p style="margin:26px', `${venue}${rsvp}</div><p style="margin:26px`);
    return { subject, html };
  }
  const unsubscribeUrl = `${getSiteUrl()}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const image = imageUrl ? `<tr><td style="padding:0"><img src="${escape(imageUrl)}" alt="${escape(event.imageAlt || event.title)}" width="640" referrerpolicy="no-referrer" style="display:block;width:100%;max-width:640px;height:auto;border:0"></td></tr>` : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;padding:0;background:${theme.background}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${theme.background};font-family:Arial,sans-serif"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px"><tr><td style="padding:0 8px 20px;color:${theme.heading};font-size:11px;letter-spacing:2px">HELIOS REAL ESTATE MEDIA</td></tr><tr><td style="border:1px solid ${theme.border};background:${theme.surface}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:16px 24px;background:${theme.accent};color:${theme.buttonText};font-size:11px;font-weight:bold;letter-spacing:2px">${escape(theme.motif)}</td></tr>${image}<tr><td style="padding:30px 24px"><h1 style="margin:0 0 24px;color:${theme.heading};font-family:Georgia,serif;font-size:30px;font-weight:normal;line-height:1.25;overflow-wrap:anywhere">${escape(event.title)}</h1>${textBody(body,theme.text)}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid ${theme.border};border-bottom:1px solid ${theme.border}"><tr><td style="padding:20px 0;color:${theme.text};font-size:16px;line-height:1.7"><strong>When</strong><br>${escape(date)} (${escape(event.timeZone)})<br><br><strong>Where</strong><br>${escape(event.location).replace(/\n/g,"<br>")}${venue}</td></tr></table>${rsvp}<p style="margin:20px 0 0;color:${theme.muted};font-size:13px;line-height:1.6">${escape(instructions)}</p></td></tr></table></td></tr><tr><td style="padding:24px 8px;color:${theme.muted};font-size:11px;line-height:1.6">You are receiving this email because you are a Helios client.<br><a href="${escape(unsubscribeUrl)}" style="color:${theme.muted}">Unsubscribe from marketing emails</a></td></tr></table></td></tr></table></body></html>`;
  return {subject, html};
}
