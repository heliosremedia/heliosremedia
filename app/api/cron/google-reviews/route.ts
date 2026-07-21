import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { syncGoogleBusinessReviews } from "@/lib/google-business-reviews";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ success: false }, { status: 401 });
  try { const result = await syncGoogleBusinessReviews(); revalidatePath("/"); revalidatePath("/admin/testimonials"); return NextResponse.json({ success: true, result }); }
  catch (error) { console.error("Scheduled Google review sync failed:", error); return NextResponse.json({ success: false }, { status: 500 }); }
}
