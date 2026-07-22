import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInquiryNotification } from "@/lib/inquiry-notifications";

function text(value: unknown, max: number, required = false) { const result = typeof value === "string" ? value.trim() : ""; if ((required && !result) || result.length > max) throw new Error("INVALID_TEXT"); return result || null; }
function email(value: unknown) { const result = text(value, 320, true)!; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new Error("INVALID_EMAIL"); return result.toLowerCase(); }
function ipHash(request: Request) { const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"; const secret = process.env.INQUIRY_HASH_SECRET || process.env.AUTH_SECRET || "local-development-only"; return createHmac("sha256", secret).update(ip).digest("hex"); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (text(body.website, 200) || typeof body.renderedAt !== "number" || Date.now() - body.renderedAt < 1800) return NextResponse.json({ success: true });
    if (body.consent !== true) throw new Error("CONSENT_REQUIRED");
    const hash = ipHash(request);
    const recent = await prisma.inquiry.count({ where: { ipHash: hash, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } } });
    if (recent >= 5) return NextResponse.json({ success: false, error: "Too many inquiries were submitted. Please try again later." }, { status: 429 });
    const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.filter((id): id is string => typeof id === "string").slice(0, 20) : [];
    if (new Set(serviceIds).size !== serviceIds.length) throw new Error("INVALID_SERVICES");
    const validServices = await prisma.service.findMany({ where: { id: { in: serviceIds }, active: true }, select: { id: true } });
    if (validServices.length !== serviceIds.length) throw new Error("INVALID_SERVICES");
    const desired = text(body.desiredDate, 30); const desiredDate = desired ? new Date(`${desired}T12:00:00.000Z`) : null; if (desiredDate && Number.isNaN(desiredDate.getTime())) throw new Error("INVALID_DATE");
    const name = text(body.name, 120, true)!; const inquiryEmail = email(body.email); const phone = text(body.phone, 40); const message = text(body.message, 3000); const sourcePage = text(body.sourcePage, 1000); const ctaName = text(body.ctaName, 120);
    const inquiry = await prisma.inquiry.create({ data: { name, email: inquiryEmail, phone, propertyAddress: text(body.propertyAddress, 240), city: text(body.city, 120), state: text(body.state, 40), postalCode: text(body.postalCode, 20), desiredDate, message, sourcePage, referrer: text(body.referrer, 1000), ctaName, utmSource: text(body.utmSource, 240), utmMedium: text(body.utmMedium, 240), utmCampaign: text(body.utmCampaign, 240), utmContent: text(body.utmContent, 240), utmTerm: text(body.utmTerm, 240), ipHash: hash, userAgent: text(request.headers.get("user-agent"), 500), consent: true, requestedServices: { create: validServices.map(({ id }) => ({ serviceId: id })) }, activities: { create: { action: "INQUIRY_CREATED", summary: ctaName === "General Contact" ? "General contact message submitted through the public website." : "Inquiry submitted through the public website." } } }, select: { id: true } });
    try { await sendInquiryNotification({ inquiryId: inquiry.id, name, email: inquiryEmail, phone, message, sourcePage, kind: ctaName === "General Contact" ? "general contact" : "project inquiry" }); }
    catch (notificationError) { console.error("Inquiry email notification could not be delivered:", notificationError); }
    const notificationUrl = process.env.INQUIRY_NOTIFICATION_WEBHOOK_URL?.trim();
    if (notificationUrl) {
      try { await fetch(notificationUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "inquiry.created", inquiryId: inquiry.id, name: text(body.name, 120, true), email: email(body.email), sourcePage: text(body.sourcePage, 1000) }), signal: AbortSignal.timeout(4000) }); }
      catch (notificationError) { console.error("Inquiry notification could not be delivered:", notificationError); }
    }
    return NextResponse.json({ success: true, inquiryId: inquiry.id }, { status: 201 });
  } catch (error) { const messages: Record<string,string> = { INVALID_TEXT: "Complete the required fields and stay within the displayed limits.", INVALID_EMAIL: "Enter a valid email address.", CONSENT_REQUIRED: "Consent is required before submitting.", INVALID_SERVICES: "One or more selected services are unavailable.", INVALID_DATE: "Choose a valid preferred date." }; if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 }); console.error("Unable to create inquiry:", error); return NextResponse.json({ success: false, error: "Your inquiry could not be sent." }, { status: 500 }); }
}
