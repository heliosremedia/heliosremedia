import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deleteContentImage, verifyContentImage } from "@/lib/content-image-storage";
import { prisma } from "@/lib/prisma";

function value(input: unknown, max = 1500) { const result = typeof input === "string" ? input.trim() : ""; if (result.length > max) throw new Error("INVALID_VALUE"); return result || null; }
function destination(input: unknown) { const result = value(input, 1000); if (!result) return "/portfolio?service=cinematic-films"; if (result.startsWith("/") && !result.startsWith("//")) return result; const parsed = new URL(result); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("INVALID_VALUE"); return parsed.toString(); }

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const videoKey = value(body.featuredFilmVideoStorageKey);
    const posterKey = value(body.featuredFilmPosterStorageKey);
    if (videoKey && !videoKey.startsWith("site/homepage/featured-film/")) throw new Error("INVALID_VALUE");
    if (posterKey && !posterKey.startsWith("site/homepage/featured-film/")) throw new Error("INVALID_VALUE");
    const existing = await prisma.siteSettings.findUnique({ where: { id: "default" }, select: { featuredFilmVideoStorageKey: true, featuredFilmPosterStorageKey: true } });
    if (videoKey !== existing?.featuredFilmVideoStorageKey) await verifyContentImage(videoKey);
    if (posterKey !== existing?.featuredFilmPosterStorageKey) await verifyContentImage(posterKey);
    const data = {
      featuredFilmEnabled: body.featuredFilmEnabled === true,
      featuredFilmVideoStorageKey: videoKey,
      featuredFilmVideoUrl: value(body.featuredFilmVideoUrl),
      featuredFilmPosterStorageKey: posterKey,
      featuredFilmPosterUrl: value(body.featuredFilmPosterUrl),
      featuredFilmDestination: destination(body.featuredFilmDestination),
    };
    if (data.featuredFilmEnabled && !data.featuredFilmVideoUrl) return NextResponse.json({ success: false, error: "Upload a film before enabling the homepage feature." }, { status: 400 });
    const settings = await prisma.siteSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    if (videoKey !== existing?.featuredFilmVideoStorageKey) await deleteContentImage(existing?.featuredFilmVideoStorageKey ?? null);
    if (posterKey !== existing?.featuredFilmPosterStorageKey) await deleteContentImage(existing?.featuredFilmPosterStorageKey ?? null);
    revalidatePath("/"); revalidatePath("/admin/homepage");
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_VALUE") return NextResponse.json({ success: false, error: "One or more featured-film values are invalid." }, { status: 400 });
    console.error("Unable to update homepage featured film:", error);
    return NextResponse.json({ success: false, error: "The featured film settings could not be saved." }, { status: 500 });
  }
}
