import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ success: false }, { status: 401 });
  return NextResponse.json({ success: true, scheduledSyncEnabled: false, message: "Google review synchronization is manual during the initial OAuth phase." });
}
