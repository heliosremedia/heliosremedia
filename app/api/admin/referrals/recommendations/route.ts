import { NextResponse } from "next/server";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { recommendedAdvocates } from "@/lib/referrals/recommendations";

export async function GET() {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  return NextResponse.json({ success: true, recommendations: await recommendedAdvocates() });
}
