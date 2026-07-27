import { NextResponse } from "next/server";
import { processDueSocialVariants } from "@/lib/social/studio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ success: false }, { status: 401 });
  return NextResponse.json({ success: true, ...(await processDueSocialVariants()) });
}
