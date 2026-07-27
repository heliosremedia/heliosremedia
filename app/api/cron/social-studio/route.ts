import { NextResponse } from "next/server";
import { processDueSocialVariants } from "@/lib/social/studio";
import { processPublishingQueue } from "@/lib/social/publishing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ success: false }, { status: 401 });
  const [manual, publishing] = await Promise.all([processDueSocialVariants(), processPublishingQueue()]);
  return NextResponse.json({ success: true, manual, publishing });
}
