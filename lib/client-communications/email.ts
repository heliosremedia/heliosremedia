import "server-only";

import { getSiteUrl } from "@/lib/site";
import { testEmailSubject } from "@/lib/newsletters/presentation";
import {
  sendEmail,
  sendEmailBatch,
  type DeliverySource,
} from "./providers/resend";

export { EmailDeliveryError } from "./providers/resend";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function renderCampaignEmail(input: {
  body: string;
  previewText?: string | null;
  unsubscribeToken: string;
}) {
  const paragraphs = input.body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 20px;color:#d7d1c8;font-size:16px;line-height:1.75">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const unsubscribeUrl = `${getSiteUrl()}/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`;
  const preview = input.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.previewText)}</div>`
    : "";
  return `${preview}<div style="margin:0;background:#0b0b0b;padding:40px 18px;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto"><p style="margin:0 0 28px;color:#df6b2b;font-size:11px;letter-spacing:.2em;text-transform:uppercase">Helios Real Estate Media</p><div style="border:1px solid #2c2a27;background:#121211;padding:42px 36px">${paragraphs}</div><p style="margin:26px 0 0;color:#777;font-size:11px;line-height:1.6">You are receiving this email because you are a Helios client.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#aaa">Unsubscribe from marketing emails</a></p></div></div>`;
}

export async function sendTestCampaign(input: {
  to: string;
  subject: string;
  html: string;
  source?: DeliverySource;
  operationId?: string;
}) {
  return sendEmail({
    to: input.to,
    subject: testEmailSubject(input.subject),
    html: input.html,
    source: input.source || "test",
    operationId: input.operationId,
  });
}

export async function sendCampaignBatch(input: {
  campaignId: string;
  messages: Array<{ to: string; subject: string; html: string; unsubscribeUrl?: string }>;
  from?: string | null;
  replyTo?: string | null;
  source?: Exclude<DeliverySource, "test">;
  revisionKey?: string;
}) {
  return sendEmailBatch({
    ...input,
    source: input.source || "campaign",
  });
}
