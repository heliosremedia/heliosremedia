import { NextResponse } from "next/server";
import { processDueSocialVariants } from "@/lib/social/studio";
import { processPublishingQueue } from "@/lib/social/publishing";
import { processAnalyticsQueue, queueAnalyticsRefresh } from "@/lib/social/analytics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ success: false }, { status: 401 });
  const refreshEnd=new Date();const refreshStart=new Date(refreshEnd.getTime()-30*86_400_000);
  const dueConnections=await prisma.socialConnection.findMany({where:{state:{in:["CONNECTED","CONNECTED_DIRECT_PUBLISHING_DISABLED"]},OR:[{analyticsLastAttemptAt:null},{analyticsLastAttemptAt:{lt:new Date(refreshEnd.getTime()-6*60*60*1000)}}]},select:{id:true},take:8});
  await Promise.all(dueConnections.map(item=>queueAnalyticsRefresh(item.id,refreshStart,refreshEnd)));
  const [manual, publishing, analytics] = await Promise.all([processDueSocialVariants(), processPublishingQueue(), processAnalyticsQueue()]);
  return NextResponse.json({ success: true, manual, publishing, analytics });
}
