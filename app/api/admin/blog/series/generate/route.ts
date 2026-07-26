import { NextResponse } from "next/server";
import { generateSeriesDraft } from "@/lib/blog-series";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { seriesId?: string };
    if (!body.seriesId) return NextResponse.json({ success: false, error: "Choose a blog series." }, { status: 400 });
    const result = await generateSeriesDraft(body.seriesId);
    return NextResponse.json({ success: true, ...result });
  } catch (cause) {
    console.error("Blog series generation failed:", cause);
    return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : "The draft could not be generated." }, { status: 500 });
  }
}
