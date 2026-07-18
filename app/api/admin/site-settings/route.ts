import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function text(value: unknown, max: number, required = false) { const result = typeof value === "string" ? value.trim() : ""; if ((required && !result) || result.length > max) throw new Error("INVALID_TEXT"); return result || null; }
function url(value: unknown) { const result = text(value, 1000); if (!result) return null; const parsed = new URL(result); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("INVALID_URL"); return parsed.toString(); }
function assetUrl(value: unknown) { const result = text(value, 1000); if (!result) return null; if (result.startsWith("/") && !result.startsWith("//")) return result; return url(result); }

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const phoneE164 = text(body.phoneE164, 30, true)!;
    if (!/^\+[1-9]\d{7,14}$/.test(phoneE164)) throw new Error("INVALID_PHONE");
    const email = text(body.email, 320);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
    const data = {
      businessName: text(body.businessName, 160, true)!, phoneDisplay: text(body.phoneDisplay, 40, true)!, phoneE164, email,
      bookingUrl: url(body.bookingUrl), heroVideoUrl: assetUrl(body.heroVideoUrl), heroPosterUrl: assetUrl(body.heroPosterUrl),
      locationLabel: text(body.locationLabel, 160, true)!, serviceArea: text(body.serviceArea, 160, true)!,
      serviceAreaDescription: text(body.serviceAreaDescription, 500), footerDescription: text(body.footerDescription, 500), availabilityMessage: text(body.availabilityMessage, 240),
      websiteUrl: url(body.websiteUrl), instagramUrl: url(body.instagramUrl), facebookUrl: url(body.facebookUrl), youtubeUrl: url(body.youtubeUrl), linkedinUrl: url(body.linkedinUrl),
      defaultSeoTitle: text(body.defaultSeoTitle, 160, true)!, defaultSeoDescription: text(body.defaultSeoDescription, 320, true)!,
    };
    const settings = await prisma.siteSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    revalidatePath("/", "layout"); revalidatePath("/admin/settings");
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const messages: Record<string, string> = { INVALID_TEXT: "Complete every required field and stay within the displayed limits.", INVALID_URL: "One or more links are not valid web addresses.", INVALID_PHONE: "Enter the phone number in international format, such as +19706825533.", INVALID_EMAIL: "Enter a valid email address." };
    if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 });
    console.error("Unable to update site settings:", error); return NextResponse.json({ success: false, error: "Global site settings could not be saved." }, { status: 500 });
  }
}
