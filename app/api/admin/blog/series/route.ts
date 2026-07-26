import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const text = (value: unknown, max: number, required = false) => {
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > max) throw new Error("INVALID");
  return result || null;
};
const pillars = (value: unknown) => Array.isArray(value)
  ? value.map(item => text(item, 100)).filter((item): item is string => Boolean(item)).slice(0, 20)
  : [];
function payload(body: Record<string, unknown>) {
  const cadence = ["WEEKLY", "BIWEEKLY", "MONTHLY"].includes(String(body.cadence)) ? String(body.cadence) as "WEEKLY" | "BIWEEKLY" | "MONTHLY" : "BIWEEKLY";
  const status = ["ACTIVE", "PAUSED", "ARCHIVED"].includes(String(body.status)) ? String(body.status) as "ACTIVE" | "PAUSED" | "ARCHIVED" : "ACTIVE";
  const nextPublishAt = new Date(String(body.nextPublishAt || ""));
  if (Number.isNaN(nextPublishAt.getTime())) throw new Error("INVALID");
  const leadDays = Math.max(1, Math.min(30, Number(body.leadDays) || 7));
  return {
    name: text(body.name, 150, true)!, purpose: text(body.purpose, 3000, true)!,
    targetAudience: text(body.targetAudience, 1000, true)!, cadence,
    nextPublishAt, nextGenerationAt: new Date(nextPublishAt.getTime() - leadDays * 86_400_000),
    leadDays, generationHour: Math.max(0, Math.min(23, Number(body.generationHour) || 8)),
    timezone: "America/Denver", contentPillars: pillars(body.contentPillars),
    brandVoice: text(body.brandVoice, 3000, true)!, prioritizeTopics: text(body.prioritizeTopics, 3000),
    avoidTopics: text(body.avoidTopics, 3000), targetLength: Math.max(500, Math.min(2500, Number(body.targetLength) || 1000)),
    seoFocus: text(body.seoFocus, 1000), preferredCta: text(body.preferredCta, 1000),
    imagePreferences: text(body.imagePreferences, 1000), status,
  };
}
export async function POST(request: Request) {
  try {
    const series = await prisma.blogSeries.create({ data: payload(await request.json()) });
    return NextResponse.json({ success: true, series }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Complete the required series fields and choose a valid publication date." }, { status: 400 });
  }
}
export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id, 200, true)!;
    const series = await prisma.blogSeries.update({ where: { id }, data: payload(body) });
    return NextResponse.json({ success: true, series });
  } catch {
    return NextResponse.json({ success: false, error: "The blog series could not be saved." }, { status: 400 });
  }
}
