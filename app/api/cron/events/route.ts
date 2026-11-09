import { NextResponse } from "next/server";
import { authenticateReferralCron } from "@/lib/referrals/cron-auth";
import { processEventDeliveries } from "@/lib/events/delivery";
export const maxDuration = 300;
export async function GET(request:Request) {
  if (!authenticateReferralCron(request.headers.get("authorization"),process.env.CRON_SECRET).authenticated) return NextResponse.json({error:"Unauthorized"},{status:401});
  try { return NextResponse.json({success:true,...await processEventDeliveries()}); } catch { return NextResponse.json({success:false,error:"Event processing failed."},{status:500}); }
}
