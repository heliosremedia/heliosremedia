import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const equal = (provided: string, expected: string) => {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
};

export async function POST(request: Request) {
  const expected = process.env.UPTIMEROBOT_WEBHOOK_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-uptimerobot-secret") || "";
  if (!expected || !provided || !equal(provided, expected)) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const providerEventId = clean(body.eventId || body.event_id || body.id, 200);
    const stateText = clean(body.state || body.status || body.eventType, 80).toLowerCase();
    if (!providerEventId || !["down", "alert", "recovered", "up"].includes(stateText)) return NextResponse.json({ success: false, error: "Invalid event." }, { status: 400 });
    const recovered = ["recovered", "up"].includes(stateText);
    await prisma.operationalIncident.upsert({
      where: { providerEventId },
      create: { providerEventId, monitorName: clean(body.monitorName || body.friendly_name, 200) || null, monitorExternalId: clean(body.monitorId || body.monitor_id, 200) || null, state: recovered ? "RECOVERED" : "OPEN", startedAt: new Date(clean(body.startedAt || body.datetime, 80) || Date.now()), recoveredAt: recovered ? new Date() : null, responseTimeMs: Number.isFinite(Number(body.responseTime)) ? Number(body.responseTime) : null, sanitizedSummary: clean(body.reason || body.message, 500) || null },
      update: { state: recovered ? "RECOVERED" : "OPEN", recoveredAt: recovered ? new Date() : null, sanitizedSummary: clean(body.reason || body.message, 500) || null },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid event." }, { status: 400 });
  }
}
