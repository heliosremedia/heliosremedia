import { NextResponse } from "next/server";
import type { SocialPlatform } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SOCIAL_PLATFORMS } from "@/lib/social/core";
import { generateSeriesOccurrences, normalizeSeriesFrequency } from "@/lib/social/series";
import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";

const clean = (value: unknown, max = 5000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const workspaceId = session.workspaceId;
    const body = await request.json() as Record<string, unknown>;
    const platforms = Array.isArray(body.platforms)
      ? [...new Set(body.platforms.map((value) => clean(value, 20).toUpperCase()))].filter((value): value is SocialPlatform => SOCIAL_PLATFORMS.includes(value as never))
      : [];
    const name = clean(body.name, 180);
    const localTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(clean(body.localTime, 5)) ? clean(body.localTime, 5) : "09:00";
    const startsAt = new Date(clean(body.startsAt, 40));
    if (!name || !platforms.length || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ success: false, error: "Add a series name, start date, and at least one platform." }, { status: 400 });
    }
    const endsAt = clean(body.endsAt, 40) ? new Date(clean(body.endsAt, 40)) : null;
    const timeZone = clean(body.timeZone, 80) || "America/Denver";
    if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt < startsAt)) return NextResponse.json({ success: false, error: "Choose an end date on or after the start date." }, { status: 400 });
    try { new Intl.DateTimeFormat("en-US", { timeZone }).format(startsAt); }
    catch { return NextResponse.json({ success: false, error: "Choose a valid time zone." }, { status: 400 }); }
    const result = await prisma.$transaction(async (tx) => {
      await requireLockedWorkspaceEditor(tx, session);
      const series = await tx.socialSeries.create({
        data: {
          workspaceId,
          name,
          description: clean(body.description),
          objective: clean(body.objective, 1000),
          defaultPlatforms: platforms,
          frequency: normalizeSeriesFrequency(body.frequency),
          interval: Math.min(52, Math.max(1, Math.trunc(number(body.interval, 1)))),
          dayOfWeek: Math.min(6, Math.max(0, Math.trunc(number(body.dayOfWeek, startsAt.getDay())))),
          dayOfMonth: Math.min(31, Math.max(1, Math.trunc(number(body.dayOfMonth, startsAt.getDate())))),
          localTime,
          timeZone,
          defaultTone: clean(body.defaultTone, 1000),
          defaultCallToAction: clean(body.defaultCallToAction, 2000),
          promptGuidance: clean(body.promptGuidance, 5000),
          startsAt,
          endsAt,
          createdById: session.userId,
          lastEditedById: session.userId,
        },
      });
      const through = new Date(startsAt);
      through.setMonth(through.getMonth() + 3);
      const generated = await generateSeriesOccurrences({ seriesId: series.id, actor: session, through }, tx);
      return { series: { id: series.id }, generated };
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Your workspace access changed. Sign in again." }, { status: 403 });
    console.error("Social series creation failed:", error);
    return NextResponse.json({ success: false, error: "The recurring series could not be created." }, { status: 500 });
  }
}
