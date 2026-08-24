import "server-only";

const escape = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);

export async function sendAutopilotReviewEmail(input: { recipients: string[]; weekLabel: string; reviewUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SOCIAL_REVIEW_EMAIL_FROM?.trim() || process.env.CAMPAIGN_EMAIL_FROM?.trim() || process.env.PORTAL_EMAIL_FROM?.trim();
  if (!apiKey || !from || !input.recipients.length) return { delivered: false, reason: "NOT_CONFIGURED" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: input.recipients, subject: `Social Studio weekly drafts are ready — ${input.weekLabel}`, html: `<div style="background:#0b0b0b;padding:40px 20px;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto"><p style="color:#d6682d;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">Social Studio</p><h1 style="color:#f4f0e9;font-family:Georgia,serif;font-weight:400">Weekly drafts ready for review</h1><p style="color:#aaa39a;line-height:1.7">${escape(input.weekLabel)} is ready. Every post remains a draft until an authorized administrator approves it in Social Studio.</p><p style="margin-top:26px"><a href="${escape(input.reviewUrl)}" style="display:inline-block;background:#d6682d;color:#fff;padding:13px 20px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Review weekly plan</a></p></div></div>` }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) { console.error("Social Studio review notification rejected", { status: response.status }); return { delivered: false, reason: "PROVIDER_REJECTED" as const }; }
  return { delivered: true as const };
}
