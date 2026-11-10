import "server-only";
import { resolveInquiryEmailConfig } from "./inquiry-email-config";

export type InquiryEmailResult = {
  status: "accepted" | "not_configured" | "rejected" | "unknown";
  reason?: string;
  providerMessageId?: string;
  providerStatus?: number;
};
export type InquiryNotificationInput = {
  inquiryId: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  sourcePage: string | null;
  kind: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function getInquiryEmailConfig() {
  return resolveInquiryEmailConfig(process.env);
}

async function send(input: {
  apiKey: string;
  inquiryId: string;
  kind: "notification" | "confirmation";
  payload: { from: string; to: string[]; reply_to?: string; subject: string; html: string; text: string };
}): Promise<InquiryEmailResult> {
  // Retry only inside this request, with the same payload/key. Never blindly replay old inquiries.
  const body = JSON.stringify(input.payload);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `inquiry-${input.inquiryId}-${input.kind}`,
        },
        body,
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt === 0) {
          const retryAfter = Number(response.headers.get("retry-after"));
          // Respect short provider backoffs; leave longer outages visible rather than holding the form open.
          if (retryAfter <= 2) {
            await new Promise((resolve) => setTimeout(resolve, Math.max(1_000, retryAfter * 1_000 || 1_000)));
            continue;
          }
        }
        // Do not store provider response bodies, which can contain submitted personal information.
        const reason = response.status === 401 || response.status === 403
          ? "The email provider rejected the credentials or sender permissions."
          : response.status === 429 ? "The email provider rate limit was reached."
            : response.status >= 500 ? "The email provider had a temporary error."
              : "The email provider rejected the message. Check the sender and recipient settings.";
        return { status: response.status >= 500 ? "unknown" : "rejected", reason, providerStatus: response.status };
      }
      const data: unknown = await response.json();
      const id = data && typeof data === "object" && "id" in data ? data.id : null;
      if (typeof id !== "string" || !id.trim()) return { status: "unknown", reason: "The email provider returned no message receipt." };
      return { status: "accepted", providerMessageId: id, providerStatus: response.status };
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      return { status: "unknown", reason: "The email provider could not be reached or timed out. Acceptance could not be confirmed." };
    }
  }
  return { status: "unknown", reason: "Email acceptance could not be confirmed." };
}

export async function sendInquiryNotification(input: InquiryNotificationInput): Promise<InquiryEmailResult> {
  const config = getInquiryEmailConfig();
  if (!config.notificationReady) return { status: "not_configured", reason: config.issues.join(" ") };
  const safe = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, escapeHtml(value ?? "Not provided")])) as Record<keyof typeof input, string>;
  return send({ apiKey: config.apiKey, inquiryId: input.inquiryId, kind: "notification", payload: {
    from: config.from,
    to: [config.to],
    reply_to: input.email,
    subject: `New ${input.kind}: ${input.name.replace(/[\r\n]+/g, " ").trim()}`,
    text: `New ${input.kind}\n\n${input.name}\n${input.email}\n${input.phone || "Phone not provided"}\n\n${input.message || "No message provided"}\n\nSource: ${input.sourcePage || "Not provided"}\nInquiry ID: ${input.inquiryId}`,
    html: `<div style="background:#0b0b0b;color:#f4f0e9;padding:40px;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto"><p style="color:#df6b2b;text-transform:uppercase;letter-spacing:.18em;font-size:12px">Helios website</p><h1 style="font-weight:400">New ${safe.kind}</h1><p style="color:#b7b2ac;line-height:1.7"><strong style="color:#fff">${safe.name}</strong><br><a style="color:#df6b2b" href="mailto:${safe.email}">${safe.email}</a><br>${safe.phone}</p><div style="border-top:1px solid #333;margin-top:28px;padding-top:24px;color:#b7b2ac;line-height:1.7;white-space:pre-wrap">${safe.message}</div><p style="color:#666;font-size:12px;margin-top:30px">Source: ${safe.sourcePage}<br>Inquiry ID: ${safe.inquiryId}</p></div></div>`,
  } });
}

export async function sendInquiryConfirmation(input: Pick<InquiryNotificationInput, "inquiryId" | "name" | "email" | "kind">): Promise<InquiryEmailResult> {
  const config = getInquiryEmailConfig();
  if (!config.senderReady) return { status: "not_configured", reason: config.senderIssues.join(" ") };
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME?.trim() || "Helios Real Estate Media";
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;
  return send({ apiKey: config.apiKey, inquiryId: input.inquiryId, kind: "confirmation", payload: {
    from: config.from,
    to: [input.email],
    reply_to: config.notificationReady ? config.to : undefined,
    subject: `We received your ${input.kind}`,
    text: `Thank you, ${firstName}.\n\nYour ${input.kind} has been received. Our team will review the details and follow up as soon as possible.\n\n${businessName}`,
    html: `<div style="background:#0b0b0b;color:#f4f0e9;padding:40px 22px;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto"><p style="color:#df6b2b;text-transform:uppercase;letter-spacing:.18em;font-size:12px">${escapeHtml(businessName)}</p><h1 style="font-weight:400;font-size:32px;line-height:1.2">Thank you, ${escapeHtml(firstName)}.</h1><p style="color:#b7b2ac;line-height:1.8;font-size:16px">Your ${escapeHtml(input.kind)} has been received. Our team will review the details and follow up as soon as possible.</p><div style="border-top:1px solid #333;margin-top:30px;padding-top:22px"><p style="color:#777;line-height:1.7;font-size:13px">This is an automatic confirmation.${config.notificationReady ? " You can reply directly to this email if you need to add anything." : ""}</p></div></div></div>`,
  } });
}
