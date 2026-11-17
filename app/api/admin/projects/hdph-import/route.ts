import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { projectHdphReader } from "@/lib/project-hdph-reader";
import { hdphId, hdphPhotoUrl, hdphSafeImageUrl } from "@/lib/project-hdph-import";

export const runtime = "nodejs";
export const maxDuration = 60;
const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0,32);
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return reply({ error: "Sign in to Studio first." },401);
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return reply({ error: "You do not have permission to import projects." },403);
  try {
    const params = new URL(request.url).searchParams;
    if (params.has("query")) {
      const offset = Number(params.get("offset") || 0);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000000) return reply({ error: "Invalid search page." },400);
      return reply(await projectHdphReader(session.workspaceId).search(params.get("query") || "", offset));
    }
    const siteId = hdphId(params.get("siteId"));
    const targetProjectId = params.get("targetProjectId");
    if (targetProjectId) {
      const target = await prisma.project.findFirst({ where: { id: targetProjectId, workspaceId: session.workspaceId, status: "DRAFT" }, select: { id: true } });
      if (!target) return reply({ error: "Target draft was not found." },404);
    }
    const site = await projectHdphReader(session.workspaceId).site(siteId);
    const imported = targetProjectId ? await prisma.media.findMany({ where: { projectId: targetProjectId, externalId: { startsWith: `hdph:${siteId}:` } }, select: { externalId: true } }) : [];
    const importedIds = new Set(imported.map(media => media.externalId));
    return reply({ ...site, photos: site.photos.map(photo => ({ ...photo, alreadyImported: importedIds.has(`hdph:${siteId}:${photo.mediaId}`) })) });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Property lookup failed." },400); }
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return reply({ error: "Sign in to Studio first." },401);
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return reply({ error: "You do not have permission to import projects." },403);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Use the import form in Studio." },403);
  try {
    const body = await request.json();
    if (body.rightsConfirmed !== true) return reply({ error: "Confirm you have permission to copy these photos into Studio." },400);
    const siteId = hdphId(body.siteId), reader = projectHdphReader(session.workspaceId);
    if (body.targetProjectId != null && (typeof body.targetProjectId !== "string" || !body.targetProjectId.length || body.targetProjectId.length > 200)) return reply({ error: "Invalid target draft." },400);
    if (!body.targetProjectId) return reply({ error: "Create a draft before importing photos." },400);
    const projectId = body.targetProjectId;
    const existing = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, status: true, workspaceId: true } });
    if (existing && (existing.workspaceId !== session.workspaceId || existing.status !== "DRAFT")) return reply({ error: "This property already has a non-draft Studio project. Open it manually; import will not change it." },409);
    if (body.targetProjectId && !existing) return reply({ error: "Target draft was not found." },404);
    if (body.action === "link") {
      if (!body.targetProjectId || !existing) return reply({ error: "Create a draft before importing photos." },400);
      await reader.site(siteId);
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
        const target = await tx.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId, status: "DRAFT" } });
        if (!target) throw new Error("This project is no longer a draft.");
        await tx.projectDetails.upsert({ where: { projectId }, create: { projectId, hdphSiteId: siteId }, update: { hdphSiteId: siteId } });
      });
      return reply({ projectId });
    }
    if (body.action !== "photo" || !existing) return reply({ error: "Create the import draft first." },400);
    const mediaId = hdphId(body.mediaId), id = `hdph_${digest(`${projectId}:${siteId}:${mediaId}`)}`;
    if (await prisma.media.findUnique({ where: { id }, select: { id: true } })) return reply({ projectId, alreadyImported: true });
    const service = await prisma.service.findFirst({ where: { workspaceId: session.workspaceId, slug: "photography", active: true, archivedAt: null }, select: { id: true } });
    if (!service) throw new Error("Enable the Photography service before importing photos. Your property draft is safe.");
    const source = await reader.photo(siteId, mediaId);
    const url = hdphSafeImageUrl(hdphPhotoUrl(source), process.env.HDPH_PROJECTS_IMAGE_HOSTS);
    const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("The photo could not be downloaded as an image. Your draft is safe; retry or use manual upload.");
    const maxBytes = 25 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > maxBytes) { await response.body?.cancel(); throw new Error("This photo exceeds the 25 MB import limit."); }
    const chunks: Uint8Array[] = []; let size = 0;
    if (!response.body) throw new Error("The image response was empty.");
    const stream = response.body.getReader();
    try {
      while (true) { const { done, value } = await stream.read(); if (done) break; size += value.length; if (size > maxBytes) { await stream.cancel(); throw new Error("This photo exceeds the 25 MB import limit."); } chunks.push(value); }
    } finally { stream.releaseLock(); }
    const { data, info } = await sharp(Buffer.concat(chunks), { limitInputPixels: 60_000_000 }).rotate().resize({ width: 3200, height: 3200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
    const { r2Client, r2Config } = await import("@/lib/r2");
    const storageKey = `projects/${projectId}/hdph/${siteId}-${mediaId}.jpg`;
    // Conditional object creation: concurrent/repeated imports cannot replace an existing file.
    try { await r2Client.send(new PutObjectCommand({ Bucket: r2Config.bucketName, Key: storageKey, Body: data, ContentType: "image/jpeg", IfNoneMatch: "*" })); }
    catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error; }
    await prisma.$transaction(async tx => {
      // Serialize against publishing and other photo imports, then recheck draft state.
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
      const project = await tx.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId, status: "DRAFT" }, select: { id: true } });
      if (!project) throw new Error("This project is no longer a draft. No media was attached.");
      const last = await tx.media.aggregate({ where: { projectId }, _max: { displayOrder: true } });
      await tx.media.upsert({ where: { id }, update: {}, create: { id, projectId, serviceId: service.id, sourceType: "UPLOADED_IMAGE", mediaCategory: "PHOTOGRAPHY", storageKey, originalFilename: `hdph-${mediaId}.jpg`, externalId: `hdph:${siteId}:${mediaId}`, mimeType: "image/jpeg", width: info.width, height: info.height, aspectRatio: info.width / info.height, fileSize: data.length, displayOrder: (last._max.displayOrder ?? -1) + 1, visibility: "VISIBLE" } });
    });
    return reply({ projectId, imported: true });
  } catch (error) {
    // Do not return provider responses, signed URLs, or credentials to clients/logs.
    const known = error instanceof Error && /^(HDPhotoHub|This |The photo|The image|Only |Enter |Enable |Create |Confirm )/.test(error.message);
    return reply({ error: known ? (error as Error).message : "Import could not finish. Your draft and imported photos are safe. Retry to resume without duplicates." },400);
  }
}
