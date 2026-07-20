import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { ClientPortalProvider } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { cleanText, cleanUrl, slugify } from "@/lib/client-portal/validation";
import { prisma } from "@/lib/prisma";

const select = { id: true, name: true, slug: true, description: true, provider: true, hdphGroupId: true, loginUrl: true, registrationUrl: true, bookingUrl: true, registrationEnabled: true, isDefault: true, active: true, displayOrder: true, createdAt: true, updatedAt: true } as const;

function provider(value: unknown): ClientPortalProvider {
  if (value === "HDPHOTOHUB" || value === "EXTERNAL") return value;
  throw new Error("INVALID_PROVIDER");
}

function groupId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0) throw new Error("INVALID_GROUP");
  return result;
}

function revalidate() {
  revalidatePath("/admin/client-portals");
  revalidatePath("/client-portal");
}

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const portals = await prisma.clientPortal.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select });
  return NextResponse.json({ success: true, portals });
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = cleanText(body.name, 120, true)!;
    const requestedSlug = slugify(typeof body.slug === "string" ? body.slug : name);
    if (!requestedSlug) throw new Error("INVALID_TEXT");
    const existing = await prisma.clientPortal.findUnique({ where: { slug: requestedSlug }, select: { id: true } });
    if (existing) throw new Error("DUPLICATE_SLUG");
    const max = await prisma.clientPortal.aggregate({ _max: { displayOrder: true } });
    const isDefault = body.isDefault === true;
    const data = {
      name,
      slug: requestedSlug,
      description: cleanText(body.description, 500),
      provider: provider(body.provider),
      hdphGroupId: groupId(body.hdphGroupId),
      loginUrl: cleanUrl(body.loginUrl),
      registrationUrl: cleanUrl(body.registrationUrl),
      bookingUrl: cleanUrl(body.bookingUrl),
      registrationEnabled: body.registrationEnabled !== false,
      isDefault,
      active: body.active !== false,
      displayOrder: (max._max.displayOrder ?? -1) + 1,
    };
    const portal = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.clientPortal.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.clientPortal.create({ data, select });
    });
    revalidate();
    return NextResponse.json({ success: true, portal }, { status: 201 });
  } catch (error) {
    const messages: Record<string, string> = { INVALID_TEXT: "Enter a valid portal name and slug.", INVALID_PROVIDER: "Choose a supported provider.", INVALID_GROUP: "Choose a valid HDPhotoHub group.", INVALID_URL: "One or more portal links are invalid.", DUPLICATE_SLUG: "That portal URL is already in use." };
    if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 });
    console.error("Unable to create client portal:", error);
    return NextResponse.json({ success: false, error: "The client portal could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = cleanText(body.id, 100, true)!;
    const name = cleanText(body.name, 120, true)!;
    const slug = slugify(typeof body.slug === "string" ? body.slug : name);
    const isDefault = body.isDefault === true;
    const data = { name, slug, description: cleanText(body.description, 500), provider: provider(body.provider), hdphGroupId: groupId(body.hdphGroupId), loginUrl: cleanUrl(body.loginUrl), registrationUrl: cleanUrl(body.registrationUrl), bookingUrl: cleanUrl(body.bookingUrl), registrationEnabled: body.registrationEnabled !== false, isDefault, active: body.active !== false };
    const portal = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.clientPortal.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      return tx.clientPortal.update({ where: { id }, data, select });
    });
    revalidate();
    return NextResponse.json({ success: true, portal });
  } catch (error) {
    console.error("Unable to update client portal:", error);
    return NextResponse.json({ success: false, error: "The client portal could not be updated. Check its name, group, and links." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Portal ID required." }, { status: 400 });
  await prisma.clientPortal.delete({ where: { id } });
  revalidate();
  return NextResponse.json({ success: true });
}
