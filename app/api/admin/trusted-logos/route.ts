import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deleteContentImage, verifyContentImage } from "@/lib/content-image-storage";
import { prisma } from "@/lib/prisma";

const logoSelect = { id: true, organizationName: true, logoStorageKey: true, logoUrl: true, logoAlt: true, websiteUrl: true, displayOrder: true, published: true, createdAt: true, updatedAt: true } as const;

function optionalText(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) throw new Error("TEXT_TOO_LONG");
  return text || null;
}

function validUrl(value: unknown) {
  const text = optionalText(value, 1000);
  if (!text) return null;
  const url = new URL(text);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("INVALID_URL");
  return url.toString();
}

function validate(body: Record<string, unknown>) {
  const organizationName = typeof body.organizationName === "string" ? body.organizationName.trim() : "";
  if (!organizationName || organizationName.length > 160) throw new Error("INVALID_NAME");
  const logoStorageKey = optionalText(body.logoStorageKey, 1000);
  if (logoStorageKey && !logoStorageKey.startsWith("trusted-logos/")) throw new Error("INVALID_KEY");
  const logoUrl = optionalText(body.logoUrl, 1500);
  if (!logoUrl) throw new Error("MISSING_LOGO");
  return { organizationName, logoStorageKey, logoUrl, logoAlt: optionalText(body.logoAlt, 240) || organizationName, websiteUrl: validUrl(body.websiteUrl) };
}

function refresh() { revalidatePath("/"); revalidatePath("/admin/trusted-logos"); }

function validationMessage(error: unknown) {
  if (!(error instanceof Error)) return null;
  return ({ INVALID_NAME: "An organization name between 1 and 160 characters is required.", INVALID_URL: "The organization website must be a valid web address.", INVALID_KEY: "The logo storage location is invalid.", MISSING_LOGO: "A logo image is required.", TEXT_TOO_LONG: "One or more fields exceed the allowed length." } as Record<string, string>)[error.message] ?? null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = validate(body);
    await verifyContentImage(data.logoStorageKey);
    const order = await prisma.trustedLogo.aggregate({ _max: { displayOrder: true } });
    const logo = await prisma.trustedLogo.create({ data: { ...data, displayOrder: (order._max.displayOrder ?? -1) + 1, published: body.published === true }, select: logoSelect });
    refresh();
    return NextResponse.json({ success: true, logo }, { status: 201 });
  } catch (error) {
    const message = validationMessage(error);
    if (message) return NextResponse.json({ success: false, error: message }, { status: 400 });
    console.error("Unable to create trusted logo:", error);
    return NextResponse.json({ success: false, error: "The trusted logo could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "reorder") {
      const ids = Array.isArray(body.logoIds) ? body.logoIds.filter((id): id is string => typeof id === "string") : [];
      const current = await prisma.trustedLogo.findMany({ select: { id: true } });
      if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) return NextResponse.json({ success: false, error: "The logo list changed before the order was saved. Refresh and try again." }, { status: 409 });
      await prisma.$transaction(ids.map((id, displayOrder) => prisma.trustedLogo.update({ where: { id }, data: { displayOrder } })));
      refresh();
      return NextResponse.json({ success: true, logoIds: ids });
    }

    const logoId = typeof body.logoId === "string" ? body.logoId : "";
    if (!logoId) return NextResponse.json({ success: false, error: "A logo ID is required." }, { status: 400 });
    if (action === "set-published") {
      if (typeof body.published !== "boolean") return NextResponse.json({ success: false, error: "A valid publishing status is required." }, { status: 400 });
      const logo = await prisma.trustedLogo.update({ where: { id: logoId }, data: { published: body.published }, select: logoSelect });
      refresh();
      return NextResponse.json({ success: true, logo });
    }
    if (action === "update") {
      const existing = await prisma.trustedLogo.findUnique({ where: { id: logoId }, select: { logoStorageKey: true } });
      if (!existing) return NextResponse.json({ success: false, error: "The logo was not found." }, { status: 404 });
      const data = validate(body);
      if (data.logoStorageKey !== existing.logoStorageKey) await verifyContentImage(data.logoStorageKey);
      const logo = await prisma.trustedLogo.update({ where: { id: logoId }, data: { ...data, ...(typeof body.published === "boolean" ? { published: body.published } : {}) }, select: logoSelect });
      const storageCleanupPending = data.logoStorageKey !== existing.logoStorageKey ? await deleteContentImage(existing.logoStorageKey) : false;
      refresh();
      return NextResponse.json({ success: true, logo, storageCleanupPending });
    }
    return NextResponse.json({ success: false, error: "Unsupported logo action." }, { status: 400 });
  } catch (error) {
    const message = validationMessage(error);
    if (message) return NextResponse.json({ success: false, error: message }, { status: 400 });
    console.error("Unable to update trusted logo:", error);
    return NextResponse.json({ success: false, error: "The trusted logo could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const logoId = new URL(request.url).searchParams.get("logoId")?.trim();
    if (!logoId) return NextResponse.json({ success: false, error: "A logo ID is required." }, { status: 400 });
    const logo = await prisma.trustedLogo.delete({ where: { id: logoId }, select: { id: true, logoStorageKey: true } });
    const storageCleanupPending = await deleteContentImage(logo.logoStorageKey);
    refresh();
    return NextResponse.json({ success: true, deletedLogoId: logo.id, storageCleanupPending });
  } catch (error) {
    console.error("Unable to delete trusted logo:", error);
    return NextResponse.json({ success: false, error: "The trusted logo could not be deleted." }, { status: 500 });
  }
}
