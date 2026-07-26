import "server-only";

import { createHash } from "node:crypto";
import { getSiteUrl } from "@/lib/site";
import { testEmailSubject } from "@/lib/newsletters/presentation";
import { oneClickUnsubscribeHeaders } from "./preference-rules";

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

function deliveryConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CAMPAIGN_EMAIL_FROM?.trim() || process.env.PORTAL_EMAIL_FROM?.trim();
  const replyTo = process.env.CAMPAIGN_REPLY_TO?.trim();
  if (!apiKey || !from) throw new EmailDeliveryError(
    "EMAIL_PROVIDER_NOT_CONFIGURED",
    "Email delivery is not configured.",
  );
  return { apiKey, from, replyTo };
}

export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: "EMAIL_PROVIDER_NOT_CONFIGURED" | "EMAIL_PROVIDER_REJECTED",
    message: string,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export async function sendTestCampaign(input: { to: string; subject: string; html: string }) {
  const { apiKey, from, replyTo } = deliveryConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], replyTo: replyTo || undefined, subject: testEmailSubject(input.subject), html: input.html }),
  });
  if (!response.ok) throw new EmailDeliveryError(
    "EMAIL_PROVIDER_REJECTED",
    `The email provider rejected the test request (${response.status}).`,
  );
}

export async function sendCampaignBatch(input: {
  campaignId: string;
  messages: Array<{ to: string; subject: string; html: string; unsubscribeUrl?: string }>;
  from?: string | null;
  replyTo?: string | null;
}) {
  const config = deliveryConfig();
  const from = input.from?.trim() || config.from;
  const replyTo = input.replyTo?.trim() || config.replyTo;
  const idempotencyKey = createHash("sha256")
    .update(`${input.campaignId}:${input.messages.map((message) => message.to).join(",")}`)
    .digest("hex");
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input.messages.map((message) => ({
      from, to: [message.to], replyTo: replyTo || undefined, subject: message.subject, html: message.html,
      headers: message.unsubscribeUrl ? oneClickUnsubscribeHeaders(message.unsubscribeUrl) : undefined,
    }))),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Email provider rejected the batch (${response.status}): ${details.slice(0, 300)}`);
  }
  const payload = await response.json() as { data?: Array<{ id?: string }> };
  return payload.data ?? [];
}
