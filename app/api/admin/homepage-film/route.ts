import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { getSiteSettingsWriteTarget } from "@/lib/site-settings-ownership";
import { verifyRegisteredBrandImage } from "@/lib/workspace-brand-assets";
import { resolveFeaturedFilmAsset } from "@/lib/homepage-film-ownership";
import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { getPublicAssetUrl } from "@/lib/r2-upload";

function value(input: unknown, max = 1500) { const result = typeof input === "string" ? input.trim() : ""; if (result.length > max) throw new Error("INVALID_VALUE"); return result || null; }
function destination(input: unknown) { const result = value(input, 1000); if (!result) return "/portfolio?service=cinematic-films"; if (result.startsWith("/") && !result.startsWith("//")) return result; const parsed = new URL(result); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("INVALID_VALUE"); return parsed.toString(); }

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  try {
    const input: unknown = await request.json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_VALUE");
    const body = input as Record<string, unknown>;
    const target = await getSiteSettingsWriteTarget(session.workspaceId);
    const existing = await prisma.siteSettings.findUnique({ where: target.where, select: {
      id: true, workspaceId: true, updatedAt: true, featuredFilmVideoStorageKey: true, featuredFilmVideoUrl: true,
      featuredFilmPosterStorageKey: true, featuredFilmPosterUrl: true,
    } });
    const video = resolveFeaturedFilmAsset(session.workspaceId, "video", { key: value(body.featuredFilmVideoStorageKey), url: value(body.featuredFilmVideoUrl) },
      existing ? { key: existing.featuredFilmVideoStorageKey, url: existing.featuredFilmVideoUrl } : null, getPublicAssetUrl);
    const poster = resolveFeaturedFilmAsset(session.workspaceId, "poster", { key: value(body.featuredFilmPosterStorageKey), url: value(body.featuredFilmPosterUrl) },
      existing ? { key: existing.featuredFilmPosterStorageKey, url: existing.featuredFilmPosterUrl } : null, getPublicAssetUrl);
    const data = {
      featuredFilmEnabled: body.featuredFilmEnabled === true,
      featuredFilmVideoStorageKey: video.key,
      featuredFilmVideoUrl: video.url,
      featuredFilmPosterStorageKey: poster.key,
      featuredFilmPosterUrl: poster.url,
      featuredFilmDestination: destination(body.featuredFilmDestination),
    };
    if (data.featuredFilmEnabled && !data.featuredFilmVideoUrl) return NextResponse.json({ success: false, error: "Upload a film before enabling the homepage feature." }, { status: 400 });
    await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "site-featured-film", key: video.key, existingKey: existing?.featuredFilmVideoStorageKey });
    await verifyRegisteredBrandImage({ workspaceId: session.workspaceId, kind: "site-featured-film", key: poster.key, existingKey: existing?.featuredFilmPosterStorageKey });
    await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, session);
      const currentTarget = await getSiteSettingsWriteTarget(session.workspaceId, tx);
      if (JSON.stringify(currentTarget) !== JSON.stringify(target)) throw new Error("FILM_SETTINGS_CHANGED");
      if (existing) {
        const changed = await tx.siteSettings.updateMany({ where: { AND: [currentTarget.where, { id: existing.id, workspaceId: existing.workspaceId, updatedAt: existing.updatedAt }] }, data: {
          ...data, updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
        } });
        if (changed.count !== 1) throw new Error("FILM_SETTINGS_CHANGED");
      } else {
        await tx.siteSettings.create({ data: { ...currentTarget.createIdentity, ...data }, select: { id: true } });
      }
    });
    // Retain replaced/shared objects until registry usage and retention prove deletion safe.
    revalidatePath("/"); revalidatePath("/admin/homepage");
    return NextResponse.json({ success: true, settings: data });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    if ((error instanceof Error && error.message === "FILM_SETTINGS_CHANGED") || (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) return NextResponse.json({ success: false, error: "Settings changed while this film was checked. Reload before saving again." }, { status: 409 });
    if (error instanceof Error && ["INVALID_VALUE", "INVALID_BRAND_IMAGE"].includes(error.message)) return NextResponse.json({ success: false, error: "One or more featured-film values are invalid." }, { status: 400 });
    console.error("Unable to update homepage featured film", { category: "request_failed" });
    return NextResponse.json({ success: false, error: "The featured film settings could not be saved." }, { status: 500 });
  }
}
