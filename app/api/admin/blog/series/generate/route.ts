import { getAdminSession } from "@/lib/auth/session";
import { requireLegacyBlogAccess } from "@/lib/blog-access";
import { NextResponse } from "next/server";
import { generateSeriesDraft } from "@/lib/blog-series";

export const maxDuration = 120;

export async function POST(request: Request) {
  const accessError = await requireLegacyBlogAccess();
  if (accessError) return accessError;
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false }, { status: 403 });
  try {
    const body = await request.json() as { seriesId?: string };
    if (!body.seriesId) return NextResponse.json({ success: false, error: "Choose a blog series." }, { status: 400 });
    const result = await generateSeriesDraft(body.seriesId, { kind: "ADMIN", actor: session });
    return NextResponse.json({ success: true, ...result });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Your workspace access changed. Sign in again." }, { status: 403 });
    if (cause instanceof Error && ["BLOG_SERIES_CHANGED", "BLOG_SERIES_OWNERSHIP_REQUIRED"].includes(cause.message)) return NextResponse.json({ success: false, error: "The series changed or its ownership is unavailable. Refresh before generating." }, { status: 409 });
    console.error("Blog series generation failed:", cause);
    return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : "The draft could not be generated." }, { status: 500 });
  }
}
