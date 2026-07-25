import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function verifyWebhook(rawBody: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1_000 - seconds) > 300) return false;
  try {
    const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
    const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
    return signatures.split(" ").some((signature) => {
      const [version, encoded] = signature.split(",");
      if (version !== "v1" || !encoded) return false;
      const received = Buffer.from(encoded, "base64");
      return received.length === expected.length && timingSafeEqual(received, expected);
    });
  } catch {
    return false;
  }
}

function normalizedEmails(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return [...new Set(values.map((item) => typeof item === "string" ? item.trim().toLowerCase() : "")
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))];
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWebhook(rawBody, request.headers)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  try {
    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: { email_id?: string; to?: unknown };
    };
    if (!["email.bounced", "email.complained"].includes(event.type ?? "")) {
      return NextResponse.json({ success: true, ignored: true });
    }
    const emails = normalizedEmails(event.data?.to);
    const reason = event.type === "email.complained" ? "COMPLAINT" : "BOUNCE";
    const status = event.type === "email.complained" ? "COMPLAINED" : "BOUNCED";
    for (const email of emails) {
      const clients = await prisma.communicationClient.findMany({
        where: { normalizedEmail: email },
        select: { id: true },
      });
      await prisma.$transaction([
        prisma.communicationClient.updateMany({
          where: { normalizedEmail: email },
          data: { emailStatus: status, emailStatusUpdatedAt: new Date() },
        }),
        prisma.communicationSuppression.upsert({
          where: {
            providerEventId: event.data?.email_id
              ? `${event.data.email_id}:${email}:${reason}` : `resend:${reason}:${email}`,
          },
          create: {
            normalizedEmail: email,
            reason,
            provider: "RESEND",
            providerEventId: event.data?.email_id
              ? `${event.data.email_id}:${email}:${reason}` : `resend:${reason}:${email}`,
            clientId: clients[0]?.id,
          },
          update: { releasedAt: null, reason, clientId: clients[0]?.id },
        }),
      ]);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to process Resend delivery event", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
