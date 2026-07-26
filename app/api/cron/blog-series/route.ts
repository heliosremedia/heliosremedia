import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSeriesDraft } from "@/lib/blog-series";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const due = await prisma.blogSeries.findMany({
    where: { status: "ACTIVE", nextGenerationAt: { not: null, lte: new Date() } },
    orderBy: { nextGenerationAt: "asc" }, take: 5,
  });
  const results = [];
  for (const series of due) {
    const claimed = await prisma.blogSeries.updateMany({
      where: { id: series.id, status: "ACTIVE", nextGenerationAt: series.nextGenerationAt },
      data: { nextGenerationAt: null },
    });
    if (!claimed.count) continue;
    try {
      const generated = await generateSeriesDraft(series.id);
      results.push({ seriesId: series.id, postId: generated.post.id, success: true });
    } catch (error) {
      await prisma.blogSeries.updateMany({
        where: { id: series.id, status: "ACTIVE", nextGenerationAt: null },
        data: { nextGenerationAt: series.nextGenerationAt },
      });
      results.push({ seriesId: series.id, success: false, error: error instanceof Error ? error.message.slice(0, 200) : "Unknown error" });
    }
  }
  return NextResponse.json({ success: true, processed: results.length, results });
}
