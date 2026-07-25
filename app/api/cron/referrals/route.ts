import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processReferralCommunications } from "@/lib/referrals/delivery";
import { referralStudioEnabled } from "@/lib/referrals/config";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false }, { status: 401 });
  if (!referralStudioEnabled()) return NextResponse.json({ success: true, disabled: true });
  try {
    return NextResponse.json({ success: true, result: await processReferralCommunications() });
  } catch (error) {
    console.error("Referral scheduler failed:", error);
    return NextResponse.json({ success: false, error: "Referral scheduling could not be completed." }, { status: 500 });
  }
}
