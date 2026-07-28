import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success:false },{status:401});
  }
  try {
    const cutoff = new Date(Date.now() - 548 * 86_400_000);
    const result = await prisma.portfolioAnalyticsEvent.deleteMany({ where:{ occurredAt:{lt:cutoff} } });
    return NextResponse.json({success:true,deleted:result.count,retentionDays:548});
  } catch(error) {
    console.error("Portfolio analytics retention failed.",error);
    return NextResponse.json({success:false},{status:500});
  }
}
