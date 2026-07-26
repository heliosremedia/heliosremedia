import { NextResponse } from "next/server";
import { claimDueEmailCampaigns, processEmailCampaign } from "@/lib/client-communications/campaign-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const campaignIds = await claimDueEmailCampaigns();
  const results = [];
  for (const campaignId of campaignIds) {
    try {
      await processEmailCampaign(campaignId);
      results.push({ campaignId, success: true });
    } catch (error) {
      results.push({ campaignId, success: false, error: error instanceof Error ? error.message : "Delivery failed." });
    }
  }
  return NextResponse.json({ success: true, claimed: campaignIds.length, results });
}
