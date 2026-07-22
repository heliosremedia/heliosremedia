import "server-only";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendInquiryNotification(input: { inquiryId: string; name: string; email: string; phone: string | null; message: string | null; sourcePage: string | null; kind: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.INQUIRY_EMAIL_FROM?.trim() || process.env.PORTAL_EMAIL_FROM?.trim();
  const to = process.env.INQUIRY_NOTIFICATION_EMAIL?.trim();
  if (!apiKey || !from || !to) return false;
  const safe = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, escapeHtml(value ?? "Not provided")])) as Record<keyof typeof input, string>;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], replyTo: input.email, subject: `New ${input.kind}: ${input.name.replace(/[\r\n]+/g, " ").trim()}`, html: `<div style="background:#0b0b0b;color:#f4f0e9;padding:40px;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto"><p style="color:#df6b2b;text-transform:uppercase;letter-spacing:.18em;font-size:12px">Helios website</p><h1 style="font-weight:400">New ${safe.kind}</h1><p style="color:#b7b2ac;line-height:1.7"><strong style="color:#fff">${safe.name}</strong><br><a style="color:#df6b2b" href="mailto:${safe.email}">${safe.email}</a><br>${safe.phone}</p><div style="border-top:1px solid #333;margin-top:28px;padding-top:24px;color:#b7b2ac;line-height:1.7;white-space:pre-wrap">${safe.message}</div><p style="color:#666;font-size:12px;margin-top:30px">Source: ${safe.sourcePage}<br>Inquiry ID: ${safe.inquiryId}</p></div></div>` }), signal: AbortSignal.timeout(5_000) });
  if (!response.ok) { console.error("Resend rejected an inquiry notification", { status: response.status, details: (await response.text()).slice(0, 1_000) }); return false; }
  return true;
}
