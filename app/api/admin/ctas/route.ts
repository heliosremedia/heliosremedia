import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { CtaActionType, CtaPlacementSlot } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const select = { id: true, internalName: true, eyebrow: true, headline: true, body: true, primaryLabel: true, primaryActionType: true, primaryValue: true, secondaryLabel: true, secondaryActionType: true, secondaryValue: true, published: true, createdAt: true, updatedAt: true, placements: { select: { slot: true } } } as const;
const actions = new Set(Object.values(CtaActionType));
const slots = new Set(Object.values(CtaPlacementSlot));

function requiredText(value: unknown, max: number) { const text = typeof value === "string" ? value.trim() : ""; if (!text || text.length > max) throw new Error("INVALID_TEXT"); return text; }
function optionalText(value: unknown, max: number) { const text = typeof value === "string" ? value.trim() : ""; if (text.length > max) throw new Error("INVALID_TEXT"); return text || null; }
function action(value: unknown, optional = false) { if (optional && (value === null || value === "" || value === undefined)) return null; if (typeof value !== "string" || !actions.has(value as CtaActionType)) throw new Error("INVALID_ACTION"); return value as CtaActionType; }
function target(type: CtaActionType | null, value: unknown) {
  const text = optionalText(value, 1000);
  if (!type || type === "BOOKING" || type === "PHONE" || type === "EMAIL") return text;
  if (type === "INTERNAL") { if (!text?.startsWith("/") || text.startsWith("//")) throw new Error("INVALID_TARGET"); return text; }
  if (!text) throw new Error("INVALID_TARGET");
  const url = new URL(text); if (!["http:", "https:"].includes(url.protocol)) throw new Error("INVALID_TARGET"); return url.toString();
}
function validate(body: Record<string, unknown>) {
  const primaryActionType = action(body.primaryActionType)!;
  const secondaryLabel = optionalText(body.secondaryLabel, 80);
  const secondaryActionType = secondaryLabel ? action(body.secondaryActionType) : null;
  return { internalName: requiredText(body.internalName, 120), eyebrow: optionalText(body.eyebrow, 120), headline: requiredText(body.headline, 240), body: optionalText(body.body, 800), primaryLabel: requiredText(body.primaryLabel, 80), primaryActionType, primaryValue: target(primaryActionType, body.primaryValue), secondaryLabel, secondaryActionType, secondaryValue: target(secondaryActionType, body.secondaryValue), published: body.published === true };
}
function placementSlots(value: unknown) { if (!Array.isArray(value)) throw new Error("INVALID_SLOTS"); const values = value.filter((item): item is CtaPlacementSlot => typeof item === "string" && slots.has(item as CtaPlacementSlot)); if (values.length !== value.length || new Set(values).size !== values.length) throw new Error("INVALID_SLOTS"); return values; }
function refresh() { revalidatePath("/", "layout"); revalidatePath("/admin/ctas"); }
function errorResponse(error: unknown) { const messages: Record<string,string> = { INVALID_TEXT: "Complete the required CTA fields and stay within their limits.", INVALID_ACTION: "Choose a valid button action.", INVALID_TARGET: "Internal links must begin with / and external links must be valid web addresses.", INVALID_SLOTS: "Choose valid, non-duplicate site placements." }; return error instanceof Error && messages[error.message] ? NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 }) : null; }

export async function POST(request: Request) {
  try { const body = await request.json() as Record<string, unknown>; const data = validate(body); const selectedSlots = placementSlots(body.slots ?? []); const cta = await prisma.$transaction(async (tx) => { const created = await tx.callToAction.create({ data }); await Promise.all(selectedSlots.map((slot) => tx.ctaPlacement.upsert({ where: { slot }, create: { slot, ctaId: created.id }, update: { ctaId: created.id } }))); return tx.callToAction.findUniqueOrThrow({ where: { id: created.id }, select }); }); refresh(); return NextResponse.json({ success: true, cta }, { status: 201 }); }
  catch (error) { const response = errorResponse(error); if (response) return response; console.error("Unable to create CTA:", error); return NextResponse.json({ success: false, error: "The CTA could not be created." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try { const body = await request.json() as Record<string, unknown>; const ctaId = requiredText(body.ctaId, 200); const data = validate(body); const selectedSlots = placementSlots(body.slots ?? []); const cta = await prisma.$transaction(async (tx) => { await tx.callToAction.update({ where: { id: ctaId }, data }); await tx.ctaPlacement.deleteMany({ where: { ctaId, slot: { notIn: selectedSlots } } }); await Promise.all(selectedSlots.map((slot) => tx.ctaPlacement.upsert({ where: { slot }, create: { slot, ctaId }, update: { ctaId } }))); return tx.callToAction.findUniqueOrThrow({ where: { id: ctaId }, select }); }); refresh(); return NextResponse.json({ success: true, cta }); }
  catch (error) { const response = errorResponse(error); if (response) return response; console.error("Unable to update CTA:", error); return NextResponse.json({ success: false, error: "The CTA could not be updated." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try { const ctaId = new URL(request.url).searchParams.get("ctaId")?.trim(); if (!ctaId) return NextResponse.json({ success: false, error: "A CTA ID is required." }, { status: 400 }); await prisma.callToAction.delete({ where: { id: ctaId } }); refresh(); return NextResponse.json({ success: true, deletedCtaId: ctaId }); }
  catch (error) { console.error("Unable to delete CTA:", error); return NextResponse.json({ success: false, error: "The CTA could not be deleted." }, { status: 500 }); }
}
